import { describe, it, expect } from "vitest";
import {
  crossoverGenomes,
  computeCrossoverSeed,
  type CrossoverParams,
} from "./crossover.js";
import { hashGenome } from "./serialize.js";
import { isSkillPath, isMemoryPath } from "./paths.js";
import type { Genome, RootHash } from "./types.js";

const ROOT_A: RootHash = `0x${"a".repeat(64)}`;
const ROOT_B: RootHash = `0x${"b".repeat(64)}`;
const SEED: `0x${string}` = `0x${"33".repeat(32)}`;
const ALT_SEED: `0x${string}` = `0x${"44".repeat(32)}`;

const parentA: Genome = {
  version: 1,
  manifest: { createdAt: 1000, generation: 0 },
  workspace: {
    "SOUL.md": "AAA-1\n\nAAA-2\n\nAAA-3",
    "TOOLS.md": "polymarket\ndune\netherscan",
    "skills/onchain-analyst/SKILL.md": "A onchain skill",
    "skills/macro-trader/SKILL.md": "A macro skill",
    "memory/0001.json": "A memory 1",
    "memory/0002.json": "A memory 2",
  },
};

const parentB: Genome = {
  version: 1,
  manifest: { createdAt: 1000, generation: 2 },
  workspace: {
    "SOUL.md": "BBB-1\n\nBBB-2\n\nBBB-3\n\nBBB-4",
    "TOOLS.md": "polymarket\nfarcaster\ntwitter",
    "skills/sentiment-reader/SKILL.md": "B sentiment skill",
    "skills/macro-trader/SKILL.md": "B macro skill",
    "memory/0003.json": "B memory 3",
    "memory/0004.json": "B memory 4",
  },
};

const baseParams: CrossoverParams = {
  parentA,
  parentB,
  parentARoot: ROOT_A,
  parentBRoot: ROOT_B,
  seed: SEED,
  createdAt: 5000,
};

describe("crossoverGenomes", () => {
  it("is deterministic given the same params", () => {
    const childA = crossoverGenomes(baseParams);
    const childB = crossoverGenomes(baseParams);
    expect(childA).toEqual(childB);
    expect(hashGenome(childA)).toEqual(hashGenome(childB));
  });

  it("produces different children for different seeds", () => {
    const childA = crossoverGenomes(baseParams);
    const childB = crossoverGenomes({ ...baseParams, seed: ALT_SEED });
    expect(hashGenome(childA)).not.toEqual(hashGenome(childB));
  });

  it("computes generation as max(parentA, parentB) + 1", () => {
    const child = crossoverGenomes(baseParams);
    expect(child.manifest.generation).toEqual(3);
  });

  it("records both parents in canonical order", () => {
    const child = crossoverGenomes(baseParams);
    expect(child.manifest.parents).toEqual([ROOT_A, ROOT_B]);
  });

  it("respects the supplied createdAt", () => {
    const child = crossoverGenomes(baseParams);
    expect(child.manifest.createdAt).toEqual(5000);
  });

  it("inherits SOUL paragraphs from both parents", () => {
    const child = crossoverGenomes(baseParams);
    const soul = child.workspace["SOUL.md"] ?? "";
    expect(soul).toMatch(/AAA/);
    expect(soul).toMatch(/BBB/);
  });

  it("merges TOOLS.md into a deduplicated subset of the union", () => {
    const child = crossoverGenomes({ ...baseParams, weights: { toolKeep: 1 } });
    const tools = (child.workspace["TOOLS.md"] ?? "").split("\n").filter(Boolean);
    expect(tools.sort()).toEqual(["dune", "etherscan", "farcaster", "polymarket", "twitter"]);
  });

  it("inherits skills only from the union of parents", () => {
    const child = crossoverGenomes({ ...baseParams, weights: { skillKeep: 1 } });
    const childSkills = Object.keys(child.workspace).filter(isSkillPath).sort();
    const unionSkills = Array.from(
      new Set([
        ...Object.keys(parentA.workspace).filter(isSkillPath),
        ...Object.keys(parentB.workspace).filter(isSkillPath),
      ])
    ).sort();
    expect(childSkills).toEqual(unionSkills);
  });

  it("inherits memory shards only from the union of parents", () => {
    const child = crossoverGenomes({ ...baseParams, weights: { memoryKeep: 1 } });
    const childMemory = Object.keys(child.workspace).filter(isMemoryPath).sort();
    const unionMemory = Array.from(
      new Set([
        ...Object.keys(parentA.workspace).filter(isMemoryPath),
        ...Object.keys(parentB.workspace).filter(isMemoryPath),
      ])
    ).sort();
    expect(childMemory).toEqual(unionMemory);
  });

  it("drops skills entirely when keep probability is 0", () => {
    const child = crossoverGenomes({ ...baseParams, weights: { skillKeep: 0 } });
    expect(Object.keys(child.workspace).filter(isSkillPath)).toHaveLength(0);
  });

  it("falls back to the other parent when one is missing a file", () => {
    const onlyA: Genome = {
      ...parentA,
      workspace: { "SOUL.md": "AAA-only" },
    };
    const emptyB: Genome = {
      version: 1,
      manifest: { createdAt: 1000, generation: 0 },
      workspace: {},
    };
    const child = crossoverGenomes({
      ...baseParams,
      parentA: onlyA,
      parentB: emptyB,
    });
    expect(child.workspace["SOUL.md"]).toEqual("AAA-only");
  });

  it("yields an empty workspace if both parents are empty", () => {
    const empty: Genome = {
      version: 1,
      manifest: { createdAt: 1000, generation: 0 },
      workspace: {},
    };
    const child = crossoverGenomes({
      ...baseParams,
      parentA: empty,
      parentB: empty,
    });
    expect(Object.keys(child.workspace)).toHaveLength(0);
  });
});

describe("computeCrossoverSeed", () => {
  it("is deterministic", () => {
    const a = computeCrossoverSeed(ROOT_A, ROOT_B, 42n);
    const b = computeCrossoverSeed(ROOT_A, ROOT_B, 42n);
    expect(a).toEqual(b);
  });

  it("ignores the order of the parent roots", () => {
    const a = computeCrossoverSeed(ROOT_A, ROOT_B, 42n);
    const b = computeCrossoverSeed(ROOT_B, ROOT_A, 42n);
    expect(a).toEqual(b);
  });

  it("differs by child token id", () => {
    const a = computeCrossoverSeed(ROOT_A, ROOT_B, 1n);
    const b = computeCrossoverSeed(ROOT_A, ROOT_B, 2n);
    expect(a).not.toEqual(b);
  });

  it("incorporates extra entropy when supplied", () => {
    const base = computeCrossoverSeed(ROOT_A, ROOT_B, 1n);
    const withExtra = computeCrossoverSeed(ROOT_A, ROOT_B, 1n, "0xdeadbeef");
    expect(base).not.toEqual(withExtra);
  });
});
