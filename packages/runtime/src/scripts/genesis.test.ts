import { describe, it, expect, vi } from "vitest";
import { validateGenome, hashGenome } from "@progena/sdk";
import { buildGenesisGenome, GENESIS_AGENTS } from "./genesis.js";

const SAMPLE_SKILLS: Record<string, string> = {
  "0g": "## 0G Skill\n\nUse 0G Compute and Storage.",
  "progena-predictor": "## Predictor\n\nForm probabilities.",
  "onchain-analyst": "## Onchain Analyst\n\nRead chain data.",
  "sentiment-reader": "## Sentiment\n\nRead social channels.",
};

const fakeLoader = (skill: string) => Promise.resolve(SAMPLE_SKILLS[skill] ?? "stub");

describe("buildGenesisGenome", () => {
  it("produces a schema-valid genesis genome with no parents", async () => {
    const spec = GENESIS_AGENTS[0]!;
    const genome = await buildGenesisGenome({ spec, loadSkill: fakeLoader, createdAt: 1_700_000_000 });

    expect(() => validateGenome(genome)).not.toThrow();
    expect(genome.manifest.generation).toEqual(0);
    expect(genome.manifest.parents).toBeUndefined();
    expect(genome.manifest.createdAt).toEqual(1_700_000_000);
  });

  it("includes SOUL.md and TOOLS.md derived from the spec", async () => {
    const spec = GENESIS_AGENTS[0]!;
    const genome = await buildGenesisGenome({ spec, loadSkill: fakeLoader });

    expect(genome.workspace["SOUL.md"]).toEqual(spec.soul);
    expect(genome.workspace["TOOLS.md"]).toEqual(spec.tools.join("\n"));
  });

  it("loads each declared skill and lays them out under skills/", async () => {
    const spec = GENESIS_AGENTS[0]!;
    const genome = await buildGenesisGenome({ spec, loadSkill: fakeLoader });

    for (const skill of spec.skills) {
      const path = `skills/${skill}/SKILL.md`;
      expect(genome.workspace[path]).toEqual(SAMPLE_SKILLS[skill]);
    }
  });

  it("calls the loader exactly once per declared skill", async () => {
    const spec = GENESIS_AGENTS[2]!;
    const loader = vi.fn(fakeLoader);

    await buildGenesisGenome({ spec, loadSkill: loader });

    expect(loader).toHaveBeenCalledTimes(spec.skills.length);
    for (const skill of spec.skills) {
      expect(loader).toHaveBeenCalledWith(skill);
    }
  });

  it("yields different genome hashes for different specs", async () => {
    const a = await buildGenesisGenome({
      spec: GENESIS_AGENTS[0]!,
      loadSkill: fakeLoader,
      createdAt: 1_700_000_000,
    });
    const b = await buildGenesisGenome({
      spec: GENESIS_AGENTS[1]!,
      loadSkill: fakeLoader,
      createdAt: 1_700_000_000,
    });

    expect(hashGenome(a)).not.toEqual(hashGenome(b));
  });

  it("yields the same genome hash for the same spec and createdAt", async () => {
    const spec = GENESIS_AGENTS[0]!;
    const a = await buildGenesisGenome({ spec, loadSkill: fakeLoader, createdAt: 1_700_000_000 });
    const b = await buildGenesisGenome({ spec, loadSkill: fakeLoader, createdAt: 1_700_000_000 });

    expect(hashGenome(a)).toEqual(hashGenome(b));
  });

  it("propagates errors from the loader", async () => {
    const spec = GENESIS_AGENTS[0]!;
    const loader = () => Promise.reject(new Error("disk full"));

    await expect(buildGenesisGenome({ spec, loadSkill: loader })).rejects.toThrow(/disk full/);
  });
});

describe("GENESIS_AGENTS", () => {
  it("ships four founder agents covering the prediction-vertical bases", () => {
    expect(GENESIS_AGENTS).toHaveLength(4);
    const names = GENESIS_AGENTS.map((a) => a.name);
    expect(names).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });

  it("every agent has the 0g and progena-predictor skills", () => {
    for (const agent of GENESIS_AGENTS) {
      expect(agent.skills).toContain("0g");
      expect(agent.skills).toContain("progena-predictor");
    }
  });
});
