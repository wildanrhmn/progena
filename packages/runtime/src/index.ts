import { execSync } from "node:child_process";
import { join } from "node:path";
import { createPublicClient, createWalletClient, getContract, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  GenomeStorage,
  roundMetadataAbi,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "./config.js";
import { createLogger } from "./lib/logger.js";
import { startBreedingWatcher, startRoundWatcher } from "./indexer/index.js";
import {
  CrossoverOrchestrator,
  RoundOrchestrator,
  createAgentRegistry,
} from "./orchestrator/index.js";
import { BreedSynthesizer } from "./round/breed-synthesizer.js";
import {
  createOpenClawInferenceClient,
  createStubInferenceClient,
  type InferenceClient,
} from "./round/inference.js";
import { createAgenticInferenceClient } from "./round/agentic-inference.js";
import { buildResolveContext } from "./round/resolve-round.js";
import { buildDefaultToolRegistry } from "./tools/index.js";
import { createFileCommitStore } from "./round/commit-store.js";

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

  const storageBackend = createZgStorageBackend({
    rpcUrl: config.rpcUrl,
    indexerUrl: config.indexerUrl,
    privateKey: config.genomeWriterPrivateKey,
  });
  const genomeStorage = new GenomeStorage(storageBackend);

  const registry = createAgentRegistry({
    address: config.addresses.agentGenome,
    publicClient,
    walletClient,
  });

  const { client: inferenceClient, mode: inferenceMode } = buildInferenceClient(logger);
  logger.info("inference backend", { mode: inferenceMode });

  // ----- Breeding orchestrator (existing) -----
  const synthesizer = new BreedSynthesizer({ inference: inferenceClient, logger });
  const crossoverOrchestrator = new CrossoverOrchestrator({
    registry,
    storage: genomeStorage,
    synthesizer,
    logger,
    computeCreatedAt: async (event) => {
      const block = await publicClient.getBlock({ blockNumber: event.blockNumber });
      return Number(block.timestamp);
    },
  });

  // ----- Round orchestrator (NEW: autonomous flow) -----
  const tavilyApiKey = process.env.TAVILY_API_KEY ?? "";
  if (!tavilyApiKey) {
    logger.warn(
      "TAVILY_API_KEY not set — research oracle will fail. Set it in runtime/.env to enable autonomous round resolution."
    );
  }

  const toolRegistry = buildDefaultToolRegistry({
    publicClient,
    addresses: {
      agentGenome: config.addresses.agentGenome,
      agentMemory: config.addresses.agentMemory,
      reputationOracle: config.addresses.reputationOracle,
      predictionRound: config.addresses.predictionRound,
      agentMetadata: config.addresses.agentMetadata,
    },
    tavilyApiKey,
  });
  const proxyBaseUrl = process.env.OPENAI_PROXY_URL ?? "http://127.0.0.1:8787/v1";
  const proxyModel = process.env.OPENAI_PROXY_MODEL ?? "deepseek/deepseek-chat-v3-0324";
  const agenticInference = createAgenticInferenceClient({
    baseUrl: proxyBaseUrl,
    model: proxyModel,
    registry: toolRegistry,
    logger,
  });

  const resolveContext = buildResolveContext({
    publicClient,
    walletClient,
    account,
    chain,
    rpcUrl: config.rpcUrl,
    predictionRoundAddress: config.addresses.predictionRound,
    agentGenomeAddress: config.addresses.agentGenome,
    agentMemoryAddress: config.addresses.agentMemory,
    reputationOracleAddress: config.addresses.reputationOracle,
    agentMetadataAddress: config.addresses.agentMetadata,
    tavilyApiKey,
    proxyBaseUrl,
    proxyModel,
    attestationPath: join(process.cwd(), "state", "oracle-attestations.json"),
    logger,
  });

  const commitStore = createFileCommitStore(
    join(process.cwd(), "state", "commits.json")
  );

  const roundMetaContract = getContract({
    address: config.addresses.roundMetadata,
    abi: roundMetadataAbi,
    client: { public: publicClient },
  });

  const roundOrchestrator = new RoundOrchestrator({
    publicClient,
    walletClient,
    account,
    chain,
    rpcUrl: config.rpcUrl,
    storage: storageBackend,
    genomeStorage,
    inference: inferenceClient,
    agenticInference,
    resolveContext,
    commitStore,
    predictionRoundAddress: config.addresses.predictionRound,
    agentGenomeAddress: config.addresses.agentGenome,
    agentMemoryAddress: config.addresses.agentMemory,
    agentMetadataAddress: config.addresses.agentMetadata,
    questionLookup: async (roundId) => {
      try {
        const text = (await roundMetaContract.read.questionOf([roundId])) as string;
        if (!text || text.length === 0) return null;
        const data = await publicClient.readContract({
          address: config.addresses.predictionRound,
          abi: [
            {
              type: "function",
              name: "roundOf",
              stateMutability: "view",
              inputs: [{ type: "uint256" }],
              outputs: [
                {
                  type: "tuple",
                  components: [
                    { name: "questionHash", type: "bytes32" },
                    { name: "commitDeadline", type: "uint64" },
                    { name: "revealDeadline", type: "uint64" },
                    { name: "entryFee", type: "uint256" },
                    { name: "totalPool", type: "uint256" },
                    { name: "totalCommitted", type: "uint256" },
                    { name: "totalRevealed", type: "uint256" },
                    { name: "outcome", type: "uint16" },
                    { name: "resolved", type: "bool" },
                  ],
                },
              ],
            },
          ] as const,
          functionName: "roundOf",
          args: [roundId],
        });
        return { question: text, questionHash: data.questionHash as `0x${string}` };
      } catch {
        return null;
      }
    },
    logger,
  });

  await roundOrchestrator.start();
  logger.info("round orchestrator started (autonomous flow active)");

  logger.info("starting breeding watcher", {
    breedingContract: config.addresses.breedingContract,
    pollingMs: config.indexerPollMs,
  });

  const stopBreeding = startBreedingWatcher({
    publicClient,
    breedingContractAddress: config.addresses.breedingContract,
    pollingIntervalMs: config.indexerPollMs,
    logger,
    onEvent: async (event) => {
      const result = await crossoverOrchestrator.handleBreeding(event);
      logger.info("breeding handled", {
        childTokenId: String(result.childTokenId),
        childRootHash: result.childRootHash,
        setRootHashTxHash: result.setRootHashTxHash,
      });
    },
  });

  logger.info("starting round watcher", {
    predictionRound: config.addresses.predictionRound,
    pollingMs: config.indexerPollMs,
  });

  const stopRound = startRoundWatcher({
    publicClient,
    predictionRoundAddress: config.addresses.predictionRound,
    pollingIntervalMs: config.indexerPollMs,
    logger,
    onCreated: async (event) => {
      await roundOrchestrator.onRoundCreated(event);
    },
  });

  logger.info("ready, awaiting events");

  const shutdown = (signal: string) => {
    logger.info("shutdown requested", { signal });
    stopBreeding();
    stopRound();
    roundOrchestrator.stop();
    setTimeout(() => process.exit(0), 250);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
