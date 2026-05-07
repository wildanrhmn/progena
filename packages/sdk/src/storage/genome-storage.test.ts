import { describe, it, expect, beforeEach } from "vitest";
import { keccak256, type Hex } from "viem";
import { GenomeStorage } from "./genome-storage.js";
import {
  StorageNotFoundError,
  type StorageBackend,
  type UploadResult,
} from "./types.js";
import { hashGenome } from "../genome/serialize.js";
import type { Genome, RootHash } from "../genome/types.js";

class InMemoryBackend implements StorageBackend {
  readonly store = new Map<RootHash, Uint8Array>();

  async upload(bytes: Uint8Array): Promise<UploadResult> {
    const rootHash = keccak256(bytes) as RootHash;
    this.store.set(rootHash, bytes);
    const txHash = ("0x" + rootHash.slice(2, 66).padEnd(64, "0")) as Hex;
    return { rootHash, txHash };
  }

  async download(rootHash: RootHash): Promise<Uint8Array> {
    const bytes = this.store.get(rootHash);
    if (!bytes) throw new StorageNotFoundError(rootHash);
    return bytes;
  }
}

const sampleGenome = (): Genome => ({
  version: 1,
  manifest: { createdAt: 1_700_000_000, generation: 0 },
  workspace: {
    "SOUL.md": "Be skeptical, ground claims in on-chain data.",
    "TOOLS.md": "polymarket\netherscan\ndune",
    "skills/onchain-analyst/SKILL.md": "Investigate wallet activity by...",
  },
});

describe("GenomeStorage", () => {
  let backend: InMemoryBackend;
  let storage: GenomeStorage;

  beforeEach(() => {
    backend = new InMemoryBackend();
    storage = new GenomeStorage(backend);
  });

  it("uploads then downloads a genome roundtrip", async () => {
    const genome = sampleGenome();
    const { rootHash } = await storage.uploadGenome(genome);
    const restored = await storage.downloadGenome(rootHash);
    expect(restored).toEqual(genome);
  });

  it("returns the keccak content hash from the in-memory backend", async () => {
    const genome = sampleGenome();
    const { rootHash } = await storage.uploadGenome(genome);
    expect(rootHash).toEqual(hashGenome(genome));
  });

  it("returns the same root hash for identical genomes regardless of key order", async () => {
    const a = sampleGenome();
    const b: Genome = {
      version: 1,
      manifest: { generation: 0, createdAt: 1_700_000_000 },
      workspace: {
        "skills/onchain-analyst/SKILL.md": "Investigate wallet activity by...",
        "TOOLS.md": "polymarket\netherscan\ndune",
        "SOUL.md": "Be skeptical, ground claims in on-chain data.",
      },
    };
    const { rootHash: rootA } = await storage.uploadGenome(a);
    const { rootHash: rootB } = await storage.uploadGenome(b);
    expect(rootA).toEqual(rootB);
  });

  it("throws StorageNotFoundError for an unknown root hash", async () => {
    const missing = `0x${"ff".repeat(32)}` as RootHash;
    await expect(storage.downloadGenome(missing)).rejects.toThrow(StorageNotFoundError);
  });

  it("rejects an invalid genome at upload time", async () => {
    const bad = {
      version: 1,
      manifest: { createdAt: -1, generation: 0 },
      workspace: {},
    } as unknown as Genome;
    await expect(storage.uploadGenome(bad)).rejects.toThrow(/invalid genome/);
  });

  it("rejects corrupted bytes at download time", async () => {
    const fakeRoot = `0x${"ab".repeat(32)}` as RootHash;
    backend.store.set(fakeRoot, new TextEncoder().encode("not json"));
    await expect(storage.downloadGenome(fakeRoot)).rejects.toThrow(/not valid JSON/);
  });

  it("preserves the txHash returned by the backend", async () => {
    const { txHash } = await storage.uploadGenome(sampleGenome());
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
