import {
  getContract,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { agentMemoryAbi, predictionRoundAbi } from "@progena/sdk";
import type { StorageBackend } from "@progena/sdk";
import type { Logger } from "../lib/logger.js";
import { MemoryAccumulator } from "./memory-accumulator.js";
import { createMemoryChain } from "./memory-chain.js";
import type { CommitStore } from "./commit-store.js";
import type { InferenceClient } from "./inference.js";

export interface MemorizeRoundContext {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  chain: Chain;
  storage: StorageBackend;
  inference: InferenceClient;
  commitStore: CommitStore;
  predictionRoundAddress: `0x${string}`;
  agentMemoryAddress: `0x${string}`;
  logger?: Logger;
}

export interface MemorizeRoundInput {
  roundId: bigint;
  question: string;
  questionHash: `0x${string}`;
  agentIds: bigint[];
}

export interface MemorizedShard {
  agentId: bigint;
  prediction: number;
  outcome: number;
  scoreDelta: number;
  rootHash: `0x${string}`;
  txHash: `0x${string}`;
  lesson: string;
}

export interface MemorizeRoundResult {
  shards: MemorizedShard[];
  skipped: Array<{ agentId: bigint; reason: string }>;
  failed: Array<{ agentId: bigint; error: string }>;
}

/**
 * Generate + anchor a memory shard for each agent that revealed in a round.
 * Each shard captures the agent's prediction, the actual outcome, the score
 * delta, an LLM-authored lesson, and the tool-call trace persisted at commit
 * time. Per-agent try/catch so one failure doesn't abort the rest.
 *
 * Pre-condition: the round must already be resolved on-chain.
 */
export async function memorizeRound(
  input: MemorizeRoundInput,
  ctx: MemorizeRoundContext
): Promise<MemorizeRoundResult> {
  const { roundId, question, questionHash, agentIds } = input;
  const log = ctx.logger?.child?.({ component: "memorize-round", roundId: String(roundId) });

  const predictionRound = getContract({
    address: ctx.predictionRoundAddress,
    abi: predictionRoundAbi,
    client: { public: ctx.publicClient },
  });
  const memoryContract = getContract({
    address: ctx.agentMemoryAddress,
    abi: agentMemoryAbi,
    client: { public: ctx.publicClient },
  });

  const roundData = await predictionRound.read.roundOf([roundId]);
  if (!roundData.resolved) {
    throw new Error(`round ${roundId} is not resolved yet (outcome unknown)`);
  }
  const outcome = roundData.outcome;
  log?.info?.("round resolved", { outcome });

  const memoryChain = createMemoryChain({
    agentMemoryAddress: ctx.agentMemoryAddress,
    publicClient: ctx.publicClient,
    walletClient: ctx.walletClient,
  });
  const accumulator = new MemoryAccumulator({
    storage: ctx.storage,
    inference: ctx.inference,
    chain: memoryChain,
    logger: log,
  });

  const shards: MemorizedShard[] = [];
  const skipped: MemorizeRoundResult["skipped"] = [];
  const failed: MemorizeRoundResult["failed"] = [];

  for (const agentId of agentIds) {
    try {
      const commit = await predictionRound.read.commitmentOf([roundId, agentId]);
      if (!commit.exists || !commit.revealed) {
        skipped.push({ agentId, reason: "no revealed commit" });
        continue;
      }

      const distance = Math.abs(Number(commit.prediction) - Number(outcome));
      const scoreDelta = 10000 - 2 * distance;
      const stored = await ctx.commitStore.get(roundId, agentId);

      const result = await accumulator.recordOutcome({
        agentId,
        roundId,
        question,
        questionHash,
        prediction: commit.prediction,
        outcome,
        scoreDelta,
        toolCalls: stored?.toolCalls,
        inferenceModel: stored?.inferenceModel,
        inferenceIterations: stored?.inferenceIterations,
        reasoningPreview: stored?.reasoningPreview,
      });

      shards.push({
        agentId,
        prediction: commit.prediction,
        outcome,
        scoreDelta,
        rootHash: result.rootHash,
        txHash: result.txHash,
        lesson: result.shard.lesson,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.error?.("memorize failed for agent (continuing)", {
        agentId: String(agentId),
        error: message,
      });
      failed.push({ agentId, error: message.split("\n")[0] ?? message });
    }
  }

  return { shards, skipped, failed };
}

export async function shardCountOf(
  publicClient: PublicClient,
  agentMemoryAddress: `0x${string}`,
  agentId: bigint
): Promise<bigint> {
  const memoryContract = getContract({
    address: agentMemoryAddress,
    abi: agentMemoryAbi,
    client: { public: publicClient },
  });
  return (await memoryContract.read.shardCountOf([agentId])) as bigint;
}
