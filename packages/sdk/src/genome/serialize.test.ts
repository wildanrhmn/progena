import { describe, it, expect } from "vitest";
import { keccak256 } from "viem";
import {
  serializeGenome,
  deserializeGenome,
  hashGenome,
} from "./serialize.js";
import { GenomeSchemaError, type Genome } from "./types.js";

const PARENT_A = `0x${"a".repeat(64)}` as const;
const PARENT_B = `0x${"b".repeat(64)}` as const;

const genesisGenome = (): Genome => ({
  version: 1,
  manifest: { createdAt: 1_700_000_000, generation: 0 },
  workspace: {
    "SOUL.md": "I am a careful, contrarian agent.",
    "TOOLS.md": "polymarket\ndune\netherscan",
    "skills/onchain-analyst/SKILL.md": "When asked about a wallet...",
  },
});

const bredGenome = (): Genome => ({
  version: 1,
  manifest: {
    createdAt: 1_700_001_000,
    generation: 1,
    parents: [PARENT_A, PARENT_B],
  },
  workspace: {
    "SOUL.md": "Inherited curiosity from A; skepticism from B.",
    "skills/onchain-analyst/SKILL.md": "...",
    "skills/sentiment-reader/SKILL.md": "...",
    "memory/0001.json": '{"observation":"BTC fell 3% on Tuesday"}',
  },
});

describe("serializeGenome / deserializeGenome", () => {
  it("roundtrips a genesis genome", () => {
    const original = genesisGenome();
    const bytes = serializeGenome(original);
    const restored = deserializeGenome(bytes);
    expect(restored).toEqual(original);
  });

  it("roundtrips a bred genome with parents", () => {
    const original = bredGenome();
    const bytes = serializeGenome(original);
    const restored = deserializeGenome(bytes);
    expect(restored).toEqual(original);
  });

  it("produces identical bytes regardless of input key order", () => {
    const a: Genome = {
      version: 1,
      manifest: { createdAt: 100, generation: 0 },
      workspace: { "b.md": "B", "a.md": "A" },
    };
    const b: Genome = {
      version: 1,
      manifest: { generation: 0, createdAt: 100 },
      workspace: { "a.md": "A", "b.md": "B" },
    };
    expect(serializeGenome(a)).toEqual(serializeGenome(b));
  });

  it("hashGenome is deterministic and matches keccak256 of serialized bytes", () => {
    const g = genesisGenome();
    const h1 = hashGenome(g);
    const h2 = hashGenome(g);
    expect(h1).toEqual(h2);
    expect(h1).toEqual(keccak256(serializeGenome(g)));
  });

  it("hashes differ when the workspace differs", () => {
    const g1 = genesisGenome();
    const g2: Genome = {
      ...g1,
      workspace: { ...g1.workspace, "SOUL.md": "different soul" },
    };
    expect(hashGenome(g1)).not.toEqual(hashGenome(g2));
  });
});

describe("validation", () => {
  it("rejects an unsupported version", () => {
    const bad = { version: 2, manifest: { createdAt: 1, generation: 0 }, workspace: {} };
    expect(() => deserializeGenome(new TextEncoder().encode(JSON.stringify(bad)))).toThrow(
      GenomeSchemaError
    );
  });

  it("rejects a parent root hash that isn't a 32-byte hex string", () => {
    const bad: unknown = {
      version: 1,
      manifest: {
        createdAt: 1,
        generation: 1,
        parents: ["0xabc", PARENT_B],
      },
      workspace: {},
    };
    expect(() => deserializeGenome(new TextEncoder().encode(JSON.stringify(bad)))).toThrow(
      GenomeSchemaError
    );
  });

  it("rejects a negative generation", () => {
    const bad: unknown = {
      version: 1,
      manifest: { createdAt: 1, generation: -1 },
      workspace: {},
    };
    expect(() => deserializeGenome(new TextEncoder().encode(JSON.stringify(bad)))).toThrow(
      GenomeSchemaError
    );
  });

  it("rejects empty workspace paths", () => {
    const bad: unknown = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: { "": "content" },
    };
    expect(() => deserializeGenome(new TextEncoder().encode(JSON.stringify(bad)))).toThrow(
      GenomeSchemaError
    );
  });

  it("rejects non-string workspace values", () => {
    const bad = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: { "x.md": 42 },
    };
    expect(() => deserializeGenome(new TextEncoder().encode(JSON.stringify(bad)))).toThrow(
      GenomeSchemaError
    );
  });

  it("rejects non-JSON bytes", () => {
    const bytes = new TextEncoder().encode("not { valid json");
    expect(() => deserializeGenome(bytes)).toThrow(/not valid JSON/);
  });
});
