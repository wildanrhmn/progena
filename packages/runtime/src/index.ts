import { execSync } from "node:child_process";
import { join } from "node:path";
import { createPublicClient, createWalletClient, getContract, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  GenomeStorage,
  predictionRoundAbi,
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
import { PrepareCommitServer } from "./server/prepare-commit-server.js";
import { RoundRunner } from "./round/round-runner.js";
import { createRoundChain } from "./round/round-chain.js";

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

  const useOpenClawAgent =
    process.env.OPENCLAW_AGENT_MODE !== "off" && openclawAvailable();
  if (useOpenClawAgent) {
    logger.info("OpenClaw agent-mode enabled for tool-less commits", {
      hint: "agents with no resolvable tools will use `openclaw agent` in a materialized workspace",
    });
  }

  const predictionRoundForLookup = getContract({
    address: config.addresses.predictionRound,
    abi: predictionRoundAbi,
    client: { public: publicClient },
  });

  const rawQuestionLookup = async (roundId: bigint) => {
    const text = (await roundMetaContract.read.questionOf([roundId])) as string;
    if (!text || text.length === 0) return null;
    const data = await predictionRoundForLookup.read.roundOf([roundId]);
    return { question: text, questionHash: data.questionHash as `0x${string}` };
  };

  const questionCache = new Map<
    string,
    { question: string; questionHash: `0x${string}` }
  >();

  const questionLookup = async (roundId: bigint) => {
    const key = roundId.toString();
    const cached = questionCache.get(key);
    if (cached) return cached;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const result = await rawQuestionLookup(roundId);
        if (result) {
          questionCache.set(key, result);
          return result;
        }
        logger.warn("questionLookup returned null", {
          roundId: key,
          attempt,
        });
      } catch (err) {
        logger.warn("questionLookup threw", {
          roundId: key,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    return null;
  };

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
    useOpenClawAgent,
    questionLookup,
    logger,
  });

  const prepareCommitRunner = new RoundRunner({
    chain: createRoundChain({
      agentGenomeAddress: config.addresses.agentGenome,
      predictionRoundAddress: config.addresses.predictionRound,
      publicClient,
      walletClient,
    }),
    storage: genomeStorage,
    inference: inferenceClient,
    agenticInference,
    useOpenClawAgent,
    commitStore,
    logger: logger.child({ component: "round-runner-prepare" }),
  });

  const prepareCommitPort = Number(process.env.PREPARE_COMMIT_PORT ?? 8788);
  const prepareCommitServer = new PrepareCommitServer({
    port: prepareCommitPort,
    host: process.env.PREPARE_COMMIT_HOST ?? "0.0.0.0",
    roundRunner: prepareCommitRunner,
    questionLookup,
    logger,
  });
  prepareCommitServer.start();

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
    prepareCommitServer.stop();
    setTimeout(() => process.exit(0), 250);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
