import { describe, it, expect, beforeEach } from "vitest";
import { keccak256, type Address, type Hex } from "viem";
import {
  GenomeStorage,
  type Genome,
  type RootHash,
  type StorageBackend,
  type UploadResult,
} from "@progena/sdk";
import { createInMemoryCommitStore } from "./commit-store.js";
import { createStubInferenceClient } from "./inference.js";
import { RoundRunner } from "./round-runner.js";
import type { RoundChain } from "./round-chain.js";
import { buildCommitHash } from "./commit.js";

const ALICE: Address = "0x000000000000000000000000000000000000A1ce";
const TX_C = `0x${"c".repeat(64)}` as Hex;
const TX_R = `0x${"d".repeat(64)}` as Hex;

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

class FakeRoundChain implements RoundChain {
  readonly roots = new Map<bigint, RootHash>();
  readonly owners = new Map<bigint, Address>();
  readonly commits: Array<{ roundId: bigint; agentId: bigint; commitHash: Hex }> = [];
  readonly reveals: Array<{
    roundId: bigint;
    agentId: bigint;
    prediction: number;
    nonce: Hex;
  }> = [];

  async rootHashOf(agentId: bigint): Promise<RootHash> {
    const r = this.roots.get(agentId);
    if (!r) throw new Error(`unknown agent ${agentId}`);
    return r;
  }
  async ownerOf(agentId: bigint): Promise<Address> {
    return this.owners.get(agentId) ?? ALICE;
  }
  async entryFeeOf(_roundId: bigint): Promise<bigint> {
    return 0n;
  }
  async commitPrediction(roundId: bigint, agentId: bigint, commitHash: Hex): Promise<Hex> {
    this.commits.push({ roundId, agentId, commitHash });
    return TX_C;
  }
  async revealPrediction(
    roundId: bigint,
    agentId: bigint,
    prediction: number,
    nonce: Hex
  ): Promise<Hex> {
    this.reveals.push({ roundId, agentId, prediction, nonce });
    return TX_R;
  }
}

const sampleGenome = (label: string): Genome => ({
  version: 1,
  manifest: { createdAt: 1, generation: 0 },
  workspace: {
    "SOUL.md": `I am agent ${label}.`,
    "skills/0g/SKILL.md": "use 0G",
    "skills/progena-predictor/SKILL.md": "form probability",
  },
});

async function setupStack() {
  const backend = new InMemoryBackend();
  const storage = new GenomeStorage(backend);
  const chain = new FakeRoundChain();
  const inference = createStubInferenceClient();
  const commitStore = createInMemoryCommitStore();

  const upA = await storage.uploadGenome(sampleGenome("alpha"));
  const upB = await storage.uploadGenome(sampleGenome("beta"));
  chain.roots.set(1n, upA.rootHash);
  chain.roots.set(2n, upB.rootHash);

  const runner = new RoundRunner({ chain, storage, inference, commitStore });

  return { backend, storage, chain, inference, commitStore, runner };
}

describe("RoundRunner.commitForAgent", () => {
  let stack: Awaited<ReturnType<typeof setupStack>>;

  beforeEach(async () => {
    stack = await setupStack();
  });

  it("downloads genome, infers, commits, and persists", async () => {
    const result = await stack.runner.commitForAgent(1n, 1n, "Will BTC moon?");

    expect(stack.chain.commits).toHaveLength(1);
    expect(stack.chain.commits[0]?.commitHash).toEqual(result.commitHash);

    const stored = await stack.commitStore.get(1n, 1n);
    expect(stored).not.toBeNull();
    expect(stored?.prediction).toEqual(result.prediction);
    expect(stored?.nonce).toEqual(result.nonce);
    expect(stored?.commitHash).toEqual(result.commitHash);
    expect(stored?.commitTxHash).toEqual(result.commitTxHash);
    expect(stored?.revealed).toEqual(false);
  });

  it("the on-chain commit hash matches the recipe used in the contract", async () => {
    const result = await stack.runner.commitForAgent(1n, 1n, "q");
    const expected = buildCommitHash(1n, 1n, result.prediction, result.nonce);
    expect(result.commitHash).toEqual(expected);
  });

  it("yields different predictions for agents with different SOUL prompts", async () => {
    const a = await stack.runner.commitForAgent(1n, 1n, "Will BTC moon?");
    const b = await stack.runner.commitForAgent(1n, 2n, "Will BTC moon?");
    expect(a.prediction).not.toEqual(b.prediction);
  });

  it("propagates errors when the agent has no on-chain genome", async () => {
    await expect(stack.runner.commitForAgent(1n, 99n, "q")).rejects.toThrow(
      /unknown agent 99/
    );
    expect(stack.chain.commits).toHaveLength(0);
  });
});

describe("RoundRunner.revealForAgent", () => {
  let stack: Awaited<ReturnType<typeof setupStack>>;

  beforeEach(async () => {
    stack = await setupStack();
  });

  it("reveals previously stored commitment and marks it revealed", async () => {
    const c = await stack.runner.commitForAgent(1n, 1n, "q");
    const r = await stack.runner.revealForAgent(1n, 1n);

    expect(r.prediction).toEqual(c.prediction);
    expect(r.revealTxHash).toEqual(TX_R);
    expect(stack.chain.reveals).toHaveLength(1);
    expect(stack.chain.reveals[0]?.prediction).toEqual(c.prediction);
    expect(stack.chain.reveals[0]?.nonce).toEqual(c.nonce);

    const stored = await stack.commitStore.get(1n, 1n);
    expect(stored?.revealed).toEqual(true);
    expect(stored?.revealTxHash).toEqual(TX_R);
  });

  it("rejects reveal when no commitment was stored", async () => {
    await expect(stack.runner.revealForAgent(1n, 1n)).rejects.toThrow(
      /no stored commitment/
    );
  });

  it("rejects double reveal of the same commitment", async () => {
    await stack.runner.commitForAgent(1n, 1n, "q");
    await stack.runner.revealForAgent(1n, 1n);

    await expect(stack.runner.revealForAgent(1n, 1n)).rejects.toThrow(
      /already revealed/
    );
  });
});

describe("RoundRunner batch helpers", () => {
  let stack: Awaited<ReturnType<typeof setupStack>>;

  beforeEach(async () => {
    stack = await setupStack();
  });

  it("commitForAgents commits each agent in order", async () => {
    const out = await stack.runner.commitForAgents(1n, [1n, 2n], "q");
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.agentId)).toEqual([1n, 2n]);
    expect(stack.chain.commits.map((c) => c.agentId)).toEqual([1n, 2n]);
  });

  it("revealForAgents reveals each previously committed agent in order", async () => {
    await stack.runner.commitForAgents(1n, [1n, 2n], "q");
    const out = await stack.runner.revealForAgents(1n, [1n, 2n]);
    expect(out).toHaveLength(2);
    expect(stack.chain.reveals.map((r) => r.agentId)).toEqual([1n, 2n]);
  });
});
