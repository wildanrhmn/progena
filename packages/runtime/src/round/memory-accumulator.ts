import { keccak256 } from "viem";
import type { Hex } from "viem";
import type { RootHash, StorageBackend } from "@progena/sdk";
import type { Logger } from "../lib/logger.js";
import type { InferenceClient } from "./inference.js";
import type { ToolCallRecord } from "../tools/types.js";

export interface MemoryShard {
  version: 1 | 2;
  agentId: string;
  roundId: string;
  questionHash: Hex;
  myPrediction: number;
  actualOutcome: number;
  scoreDelta: number;
  lesson: string;
  recordedAt: number;
  toolCalls?: ToolCallRecord[];
  inferenceModel?: string;
  inferenceIterations?: number;
  reasoningPreview?: string;
}

export interface MemoryChain {
  addShard(agentId: bigint, shardRootHash: RootHash): Promise<Hex>;
}

export interface MemoryAccumulatorOptions {
  storage: StorageBackend;
  inference: InferenceClient;
  chain: MemoryChain;
  logger?: Logger;
  now?: () => number;
}

export interface RecordOutcomeInput {
  agentId: bigint;
  roundId: bigint;
  question: string;
  questionHash: Hex;
  prediction: number;
  outcome: number;
  scoreDelta: number;
  agentSystemPrompt?: string;
  toolCalls?: ToolCallRecord[];
  inferenceModel?: string;
  inferenceIterations?: number;
  reasoningPreview?: string;
}

export interface RecordOutcomeResult {
  shard: MemoryShard;
  rootHash: RootHash;
  txHash: Hex;
}

export class MemoryAccumulator {
  constructor(private readonly opts: MemoryAccumulatorOptions) {}

  async recordOutcome(input: RecordOutcomeInput): Promise<RecordOutcomeResult> {
    const log = this.opts.logger?.child({
      component: "memory-accumulator",
      agentId: String(input.agentId),
      roundId: String(input.roundId),
    });

    log?.info("generating lesson");
    const lesson = await this.generateLesson(input);

    const shard: MemoryShard = {
      version: 2,
      agentId: String(input.agentId),
      roundId: String(input.roundId),
      questionHash: input.questionHash,
      myPrediction: input.prediction,
      actualOutcome: input.outcome,
      scoreDelta: input.scoreDelta,
      lesson,
      recordedAt: this.now(),
      toolCalls: input.toolCalls,
      inferenceModel: input.inferenceModel,
      inferenceIterations: input.inferenceIterations,
      reasoningPreview: input.reasoningPreview,
    };

    const bytes = serializeShard(shard);
    log?.info("uploading shard", { bytes: bytes.length });
    const upload = await this.opts.storage.upload(bytes);

    log?.info("recording on-chain", { rootHash: upload.rootHash });
    const txHash = await this.opts.chain.addShard(input.agentId, upload.rootHash);

    log?.info("shard recorded", { txHash });
    return { shard, rootHash: upload.rootHash, txHash };
  }

  private async generateLesson(input: RecordOutcomeInput): Promise<string> {
    const systemPrompt =
      input.agentSystemPrompt ??
      "You are an autonomous prediction agent reflecting on your latest round.";
    const userPrompt = [
      `Question: ${input.question}`,
      `My prediction (bps 0-10000): ${input.prediction}`,
      `Actual outcome (bps): ${input.outcome}`,
      `Score I received: ${input.scoreDelta} (range -10000..+10000)`,
      ``,
      `In ONE concise sentence, what's the lesson for future predictions?`,
      `Output ONLY the lesson sentence, no preamble.`,
    ].join("\n");

    const response = await this.opts.inference.complete({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 120,
    });

    const lesson = response.text.trim().replace(/^[\s"']+|[\s"']+$/g, "");
    return lesson.length > 0 ? lesson : "(no lesson generated)";
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Math.floor(Date.now() / 1000);
  }
}

function serializeShard(shard: MemoryShard): Uint8Array {
  const sorted = stableStringify(shard);
  return new TextEncoder().encode(sorted);
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function deserializeShard(bytes: Uint8Array): MemoryShard {
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as MemoryShard;
  if (parsed.version !== 1 && parsed.version !== 2) {
    throw new Error(`unsupported memory shard version: ${parsed.version}`);
  }
  return parsed;
}

export function shardContentHash(shard: MemoryShard): Hex {
  return keccak256(serializeShard(shard));
}
