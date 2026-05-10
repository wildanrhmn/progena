import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  GenomeStorage,
  createZgStorageBackend,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { loadConfig } from "./config.js";
import { createLogger } from "./lib/logger.js";
import { startBreedingWatcher } from "./indexer/index.js";
import {
  CrossoverOrchestrator,
  createAgentRegistry,
} from "./orchestrator/index.js";

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

  const orchestrator = new CrossoverOrchestrator({
    registry,
    storage,
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
