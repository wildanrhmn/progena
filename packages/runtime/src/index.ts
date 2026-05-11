import { execSync } from "node:child_process";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GenomeStorage, zgGalileo, zgMainnet } from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "./config.js";
import { createLogger } from "./lib/logger.js";
import { startBreedingWatcher } from "./indexer/index.js";
import {
  CrossoverOrchestrator,
  createAgentRegistry,
} from "./orchestrator/index.js";
import { BreedSynthesizer } from "./round/breed-synthesizer.js";
import {
  createOpenClawInferenceClient,
  createStubInferenceClient,
  type InferenceClient,
} from "./round/inference.js";

function openclawAvailable(bin = "openclaw"): boolean {
  try {
    execSync(`${bin} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function buildInferenceClient(
  logger: ReturnType<typeof createLogger>
): { client: InferenceClient; mode: string } {
  if (process.env.INFERENCE_MODE === "stub") {
    return { client: createStubInferenceClient(), mode: "stub (forced)" };
  }
  if (openclawAvailable()) {
    return {
      client: createOpenClawInferenceClient({ logger }),
      mode: "OpenClaw → 0G Compute (via proxy)",
    };
  }
  return {
    client: createStubInferenceClient(),
    mode: "stub (openclaw not available)",
  };
}

export const RUNTIME_VERSION = "0.0.0";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "progena-runtime", version: RUNTIME_VERSION, network: config.network },
  });

  logger.info("boot");

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);

  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const storage = new GenomeStorage(
    createZgStorageBackend({
      rpcUrl: config.rpcUrl,
      indexerUrl: config.indexerUrl,
      privateKey: config.genomeWriterPrivateKey,
    })
  );

  const registry = createAgentRegistry({
    address: config.addresses.agentGenome,
    publicClient,
    walletClient,
  });

  const { client: inferenceClient, mode: inferenceMode } = buildInferenceClient(logger);
  logger.info("inference backend", { mode: inferenceMode });

  const synthesizer = new BreedSynthesizer({
    inference: inferenceClient,
    logger,
  });

  const orchestrator = new CrossoverOrchestrator({
    registry,
    storage,
    synthesizer,
    logger,
    computeCreatedAt: async (event) => {
      const block = await publicClient.getBlock({ blockNumber: event.blockNumber });
      return Number(block.timestamp);
    },
  });

  logger.info("starting breeding watcher", {
    breedingContract: config.addresses.breedingContract,
    pollingMs: config.indexerPollMs,
  });

  const stop = startBreedingWatcher({
    publicClient,
    breedingContractAddress: config.addresses.breedingContract,
    pollingIntervalMs: config.indexerPollMs,
    logger,
    onEvent: async (event) => {
      const result = await orchestrator.handleBreeding(event);
      logger.info("breeding handled", {
        childTokenId: String(result.childTokenId),
        childRootHash: result.childRootHash,
        setRootHashTxHash: result.setRootHashTxHash,
      });
    },
  });

  logger.info("ready, awaiting events");

  const shutdown = (signal: string) => {
    logger.info("shutdown requested", { signal });
    stop();
    setTimeout(() => process.exit(0), 250);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
