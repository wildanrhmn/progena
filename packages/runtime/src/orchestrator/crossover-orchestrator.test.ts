import { describe, it, expect, beforeEach } from "vitest";
import { keccak256, type Address, type Hex } from "viem";
import {
  GenomeStorage,
  hashGenome,
  type Genome,
  type RootHash,
  type StorageBackend,
  type UploadResult,
} from "@progena/sdk";
import { CrossoverOrchestrator } from "./crossover-orchestrator.js";
import type { AgentRegistry } from "./types.js";
import type { BreedingEvent } from "../indexer/types.js";

const ALICE: Address = "0x000000000000000000000000000000000000A1ce";

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

class FakeRegistry implements AgentRegistry {
  readonly roots = new Map<bigint, RootHash>();
  readonly finalized = new Map<bigint, RootHash>();
  finalizeCalls = 0;

  async rootHashOf(tokenId: bigint): Promise<RootHash> {
    const r = this.roots.get(tokenId);
    if (!r) throw new Error(`unknown agent ${tokenId}`);
    return r;
  }

  async finalizeChild(tokenId: bigint, rootHash: RootHash): Promise<Hex> {
    this.finalizeCalls += 1;
    this.finalized.set(tokenId, rootHash);
    return ("0x" + "f".repeat(64)) as Hex;
  }
}

const parentAGenome: Genome = {
  version: 1,
  manifest: { createdAt: 1_700_000_000, generation: 0 },
  workspace: {
    "SOUL.md": "AAA-1\n\nAAA-2",
    "TOOLS.md": "polymarket\netherscan",
    "skills/onchain-analyst/SKILL.md": "A1",
  },
};

const parentBGenome: Genome = {
  version: 1,
  manifest: { createdAt: 1_700_000_000, generation: 1 },
  workspace: {
    "SOUL.md": "BBB-1\n\nBBB-2",
    "TOOLS.md": "polymarket\nfarcaster",
    "skills/sentiment-reader/SKILL.md": "B1",
  },
};

function makeEvent(overrides: Partial<BreedingEvent> = {}): BreedingEvent {
  return {
    childTokenId: 3n,
    breeder: ALICE,
    parentA: 1n,
    parentB: 2n,
    totalFeesPaid: 0n,
    blockNumber: 100n,
    txHash: ("0x" + "a".repeat(64)) as Hex,
    logIndex: 0,
    ...overrides,
  };
}

async function setupStack() {
  const backend = new InMemoryBackend();
  const storage = new GenomeStorage(backend);
  const registry = new FakeRegistry();

  const upA = await storage.uploadGenome(parentAGenome);
  const upB = await storage.uploadGenome(parentBGenome);
  registry.roots.set(1n, upA.rootHash);
  registry.roots.set(2n, upB.rootHash);

  const orchestrator = new CrossoverOrchestrator({
    registry,
    storage,
    computeCreatedAt: () => 1_700_900_000,
  });

  return { backend, storage, registry, orchestrator, parentARoot: upA.rootHash, parentBRoot: upB.rootHash };
}

describe("CrossoverOrchestrator.handleBreeding", () => {
  let stack: Awaited<ReturnType<typeof setupStack>>;

  beforeEach(async () => {
    stack = await setupStack();
  });

  it("fetches parent roots, downloads, crosses, uploads, and finalizes", async () => {
    const result = await stack.orchestrator.handleBreeding(makeEvent());

    expect(result.parentARoot).toEqual(stack.parentARoot);
    expect(result.parentBRoot).toEqual(stack.parentBRoot);
    expect(stack.registry.finalized.get(3n)).toEqual(result.childRootHash);
    expect(stack.registry.finalizeCalls).toEqual(1);
  });

  it("records the parents and computes generation as max(parents) + 1", async () => {
    const result = await stack.orchestrator.handleBreeding(makeEvent());

    expect(result.childGenome.manifest.parents).toEqual([
      stack.parentARoot,
      stack.parentBRoot,
    ]);
    expect(result.childGenome.manifest.generation).toEqual(2);
  });

  it("uses the supplied createdAt for the child manifest", async () => {
    const result = await stack.orchestrator.handleBreeding(makeEvent());
    expect(result.childGenome.manifest.createdAt).toEqual(1_700_900_000);
  });

  it("is deterministic across two runs with the same event", async () => {
    const r1 = await stack.orchestrator.handleBreeding(makeEvent());

    const stack2 = await setupStack();
    const r2 = await stack2.orchestrator.handleBreeding(makeEvent());

    expect(hashGenome(r1.childGenome)).toEqual(hashGenome(r2.childGenome));
  });

  it("produces different children for different child token ids", async () => {
    const r3 = await stack.orchestrator.handleBreeding(makeEvent({ childTokenId: 3n }));
    const stack2 = await setupStack();
    const r4 = await stack2.orchestrator.handleBreeding(makeEvent({ childTokenId: 4n }));

    expect(hashGenome(r3.childGenome)).not.toEqual(hashGenome(r4.childGenome));
  });

  it("propagates errors when a parent is missing from the registry", async () => {
    await expect(
      stack.orchestrator.handleBreeding(makeEvent({ parentA: 99n }))
    ).rejects.toThrow(/unknown agent 99/);
    expect(stack.registry.finalizeCalls).toEqual(0);
  });

  it("uploads the child genome to storage before finalizing", async () => {
    const result = await stack.orchestrator.handleBreeding(makeEvent());
    expect(stack.backend.store.has(result.childRootHash)).toEqual(true);
  });
});
