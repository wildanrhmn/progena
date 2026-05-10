import { describe, it, expect } from "vitest";
import type { Genome } from "@progena/sdk";
import { toAgentContext, buildPredictionUserPrompt } from "./agent-context.js";

const sample: Genome = {
  version: 1,
  manifest: { createdAt: 1, generation: 0 },
  workspace: {
    "SOUL.md": "I am Alpha. I anchor every belief to verifiable on-chain evidence.",
    "TOOLS.md": "polymarket\netherscan\ndune",
    "skills/0g/SKILL.md": "0G inference and storage instructions.",
    "skills/onchain-analyst/SKILL.md": "Read chain data, output evidence notes.",
  },
};

describe("toAgentContext", () => {
  it("merges SOUL, skills, and tools into one system prompt", () => {
    const ctx = toAgentContext(sample);
    expect(ctx.systemPrompt).toMatch(/I am Alpha/);
    expect(ctx.systemPrompt).toMatch(/Skill: 0g/);
    expect(ctx.systemPrompt).toMatch(/Skill: onchain-analyst/);
    expect(ctx.systemPrompt).toMatch(/Available tools/);
    expect(ctx.systemPrompt).toMatch(/- polymarket/);
  });

  it("returns the parsed tool list", () => {
    const ctx = toAgentContext(sample);
    expect(ctx.toolList).toEqual(["polymarket", "etherscan", "dune"]);
  });

  it("returns the sorted skill names", () => {
    const ctx = toAgentContext(sample);
    expect(ctx.skillNames).toEqual(["0g", "onchain-analyst"]);
  });

  it("handles a genome with no skills or tools gracefully", () => {
    const minimal: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: { "SOUL.md": "minimal soul" },
    };
    const ctx = toAgentContext(minimal);
    expect(ctx.systemPrompt).toEqual("minimal soul");
    expect(ctx.toolList).toEqual([]);
    expect(ctx.skillNames).toEqual([]);
  });

  it("returns an empty system prompt for an empty workspace", () => {
    const empty: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: {},
    };
    const ctx = toAgentContext(empty);
    expect(ctx.systemPrompt).toEqual("");
    expect(ctx.toolList).toEqual([]);
    expect(ctx.skillNames).toEqual([]);
  });

  it("ignores empty SOUL or TOOLS sections", () => {
    const noisy: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: { "SOUL.md": "   ", "TOOLS.md": "\n\n" },
    };
    const ctx = toAgentContext(noisy);
    expect(ctx.systemPrompt).toEqual("");
    expect(ctx.toolList).toEqual([]);
  });
});

describe("buildPredictionUserPrompt", () => {
  it("contains the question and the format instruction", () => {
    const prompt = buildPredictionUserPrompt("Will BTC close above $100k?");
    expect(prompt).toMatch(/Will BTC close above \$100k\?/);
    expect(prompt).toMatch(/PREDICTION: <integer 0-10000>/);
  });

  it("trims surrounding whitespace from the question", () => {
    const prompt = buildPredictionUserPrompt("   trimmed   ");
    expect(prompt).toMatch(/Question: trimmed\n/);
  });
});
