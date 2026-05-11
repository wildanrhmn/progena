import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  agentMemoryAbi,
  predictionRoundAbi,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { MemoryAccumulator } from "../round/memory-accumulator.js";
import { createMemoryChain } from "../round/memory-chain.js";
import { createFileCommitStore } from "../round/commit-store.js";
import {
  createOpenClawInferenceClient,
  createStubInferenceClient,
  type InferenceClient,
} from "../round/inference.js";
import type { Logger } from "../lib/logger.js";
import { bigintArg, listArg } from "./args.js";
import { getRound } from "./round-store.js";

function openclawAvailable(bin = "openclaw"): boolean {
  try {
    execSync(`${bin} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function buildInference(logger: Logger): { client: InferenceClient; mode: string } {
  if (process.env.INFERENCE_MODE !== "stub" && openclawAvailable()) {
    return {
      client: createOpenClawInferenceClient({ logger }),
      mode: "OpenClaw → 0G Compute (via proxy)",
    };
  }
  return { client: createStubInferenceClient(), mode: "stub" };
}

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const agentIds = listArg("agents");
  const storePath = join(process.cwd(), "state", "rounds.json");
  const commitStorePath = join(process.cwd(), "state", "commits.json");
  const commitStore = createFileCommitStore(commitStorePath);

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-memorize", network: config.network, roundId: String(roundId) },
  });

  const round = await getRound(storePath, roundId);
  if (!round) {
    throw new Error(`round ${roundId} not found in ${storePath}`);
  }

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const predictionRound = getContract({
    address: config.addresses.predictionRound,
    abi: predictionRoundAbi,
    client: { public: publicClient },
  });
  const memoryContract = getContract({
    address: config.addresses.agentMemory,
    abi: agentMemoryAbi,
    client: { public: publicClient },
  });

  const roundData = await predictionRound.read.roundOf([roundId]);
  if (!roundData.resolved) {
    throw new Error(`round ${roundId} is not resolved yet (outcome unknown)`);
  }
  const outcome = roundData.outcome;
  logger.info("round resolved", { outcome });

  const storage = createZgStorageBackend({
    rpcUrl: config.rpcUrl,
    indexerUrl: config.indexerUrl,
    privateKey: config.genomeWriterPrivateKey,
  });
  const memoryChain = createMemoryChain({
    agentMemoryAddress: config.addresses.agentMemory,
    publicClient,
    walletClient,
  });
  const { client: inference, mode: inferenceMode } = buildInference(logger);
  logger.info("inference backend", { mode: inferenceMode });

  const accumulator = new MemoryAccumulator({
    storage,
    inference,
    chain: memoryChain,
    logger,
  });

  console.log(`\n=== Memorizing round ${roundId} (outcome ${outcome}) for ${agentIds.length} agents ===\n`);

  for (const agentId of agentIds) {
    try {
      const beforeCount = (await memoryContract.read.shardCountOf([agentId])) as bigint;
      const commit = await predictionRound.read.commitmentOf([roundId, agentId]);
      if (!commit.exists || !commit.revealed) {
        logger.warn("skipping agent (no revealed commit)", {
          agentId: String(agentId),
        });
        continue;
      }
      const distance = Math.abs(Number(commit.prediction) - Number(outcome));
      const scoreDelta = 10000 - 2 * distance;

      const stored = await commitStore.get(roundId, agentId);

      const result = await accumulator.recordOutcome({
        agentId,
        roundId,
        question: round.question,
        questionHash: round.questionHash,
        prediction: commit.prediction,
        outcome,
        scoreDelta,
        toolCalls: stored?.toolCalls,
        inferenceModel: stored?.inferenceModel,
        inferenceIterations: stored?.inferenceIterations,
        reasoningPreview: stored?.reasoningPreview,
      });

      const afterCount = (await memoryContract.read.shardCountOf([agentId])) as bigint;
      console.log(`agent ${agentId}`);
      console.log(`  prediction:    ${commit.prediction}`);
      console.log(`  outcome:       ${outcome}`);
      console.log(`  scoreDelta:    ${scoreDelta}`);
      console.log(`  lesson:        ${result.shard.lesson.slice(0, 160)}${result.shard.lesson.length > 160 ? "…" : ""}`);
      console.log(`  shardRootHash: ${result.rootHash}`);
      console.log(`  addShard tx:   ${result.txHash}`);
      console.log(`  shardCount:    ${beforeCount} → ${afterCount}\n`);
    } catch (err) {
      logger.error("memorize failed for agent (continuing)", {
        agentId: String(agentId),
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`agent ${agentId}  FAILED — ${err instanceof Error ? err.message.split("\n")[0] : String(err)}\n`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
