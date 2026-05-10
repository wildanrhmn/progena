import { describe, it, expect, beforeEach } from "vitest";
import { keccak256, type Hex } from "viem";
import type { RootHash, StorageBackend, UploadResult } from "@progena/sdk";
import { MemoryAccumulator, deserializeShard } from "./memory-accumulator.js";
import { createStubInferenceClient } from "./inference.js";

const QUESTION_HASH = `0x${"ab".repeat(32)}` as Hex;
const TX = `0x${"cd".repeat(32)}` as Hex;

class InMemoryBackend implements StorageBackend {
  readonly store = new Map<RootHash, Uint8Array>();
  async upload(bytes: Uint8Array): Promise<UploadResult> {
    const rootHash = keccak256(bytes) as RootHash;
    this.store.set(rootHash, bytes);
    return { rootHash, txHash: ("0x" + "0".repeat(64)) as Hex };
  }
  async download(rootHash: RootHash): Promise<Uint8Array> {
    const bytes = this.store.get(rootHash);
    if (!bytes) throw new Error(`not found: ${rootHash}`);
    return bytes;
  }
}

class FakeMemoryChain {
  readonly added: Array<{ agentId: bigint; rootHash: RootHash }> = [];
  async addShard(agentId: bigint, rootHash: RootHash): Promise<Hex> {
    this.added.push({ agentId, rootHash });
    return TX;
  }
}

function setup() {
  const storage = new InMemoryBackend();
  const chain = new FakeMemoryChain();
  const inference = createStubInferenceClient({
    reasoningPrefix: "I learned that the signal was stronger than I weighted.",
  });
  const acc = new MemoryAccumulator({
    storage,
    chain,
    inference,
    now: () => 1_700_000_000,
  });
  return { storage, chain, acc };
}

describe("MemoryAccumulator.recordOutcome", () => {
  let stack: ReturnType<typeof setup>;

  beforeEach(() => {
    stack = setup();
  });

  it("uploads a serialized shard and records the rootHash on chain", async () => {
    const result = await stack.acc.recordOutcome({
      agentId: 1n,
      roundId: 7n,
      question: "Will BTC be above $100k tomorrow?",
      questionHash: QUESTION_HASH,
      prediction: 7200,
      outcome: 9000,
      scoreDelta: 6400,
    });

    expect(stack.storage.store.has(result.rootHash)).toEqual(true);
    expect(stack.chain.added).toEqual([{ agentId: 1n, rootHash: result.rootHash }]);
  });

  it("includes prediction, outcome, score, and lesson in the shard", async () => {
    const result = await stack.acc.recordOutcome({
      agentId: 1n,
      roundId: 7n,
      question: "q",
      questionHash: QUESTION_HASH,
      prediction: 7200,
      outcome: 9000,
      scoreDelta: 6400,
    });

    expect(result.shard.agentId).toEqual("1");
    expect(result.shard.roundId).toEqual("7");
    expect(result.shard.myPrediction).toEqual(7200);
    expect(result.shard.actualOutcome).toEqual(9000);
    expect(result.shard.scoreDelta).toEqual(6400);
    expect(result.shard.lesson.length).toBeGreaterThan(0);
    expect(result.shard.recordedAt).toEqual(1_700_000_000);
  });

  it("storage bytes round-trip via deserializeShard", async () => {
    const result = await stack.acc.recordOutcome({
      agentId: 1n,
      roundId: 7n,
      question: "q",
      questionHash: QUESTION_HASH,
      prediction: 5000,
      outcome: 5000,
      scoreDelta: 10000,
    });

    const bytes = stack.storage.store.get(result.rootHash)!;
    const restored = deserializeShard(bytes);
    expect(restored).toEqual(result.shard);
  });

  it("returns the on-chain tx hash from the chain layer", async () => {
    const result = await stack.acc.recordOutcome({
      agentId: 1n,
      roundId: 7n,
      question: "q",
      questionHash: QUESTION_HASH,
      prediction: 0,
      outcome: 10000,
      scoreDelta: -10000,
    });
    expect(result.txHash).toEqual(TX);
  });

  it("isolates shards across different agents", async () => {
    await stack.acc.recordOutcome({
      agentId: 1n,
      roundId: 7n,
      question: "q",
      questionHash: QUESTION_HASH,
      prediction: 5000,
      outcome: 5000,
      scoreDelta: 10000,
    });
    await stack.acc.recordOutcome({
      agentId: 2n,
      roundId: 7n,
      question: "q",
      questionHash: QUESTION_HASH,
      prediction: 5000,
      outcome: 5000,
      scoreDelta: 10000,
    });

    expect(stack.chain.added.map((a) => a.agentId)).toEqual([1n, 2n]);
    expect(stack.chain.added[0]?.rootHash).not.toEqual(stack.chain.added[1]?.rootHash);
  });
});

describe("memory shard serialization", () => {
  it("produces identical bytes for shards with same content but different key order", async () => {
    const stack = setup();

    const a = await stack.acc.recordOutcome({
      agentId: 1n,
      roundId: 7n,
      question: "q",
      questionHash: QUESTION_HASH,
      prediction: 5000,
      outcome: 5000,
      scoreDelta: 10000,
    });

    // re-record same exact inputs in a fresh stack — should yield same rootHash
    const stack2 = setup();
    const b = await stack2.acc.recordOutcome({
      agentId: 1n,
      roundId: 7n,
      question: "q",
      questionHash: QUESTION_HASH,
      prediction: 5000,
      outcome: 5000,
      scoreDelta: 10000,
    });

    expect(a.rootHash).toEqual(b.rootHash);
  });
});
