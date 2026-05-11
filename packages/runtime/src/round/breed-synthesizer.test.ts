import { describe, it, expect, beforeEach } from "vitest";
import type { Hex } from "viem";
import {
  computeCrossoverSeed,
  hashGenome,
  type Genome,
  type RootHash,
} from "@progena/sdk";
import {
  BreedSynthesizer,
  SYNTHESIS_FILE,
  parseSynthesisMetadata,
  renderSynthesisMarkdown,
} from "./breed-synthesizer.js";
import type { InferenceClient, InferenceRequest } from "./inference.js";

const PARENT_A_ROOT =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as RootHash;
const PARENT_B_ROOT =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as RootHash;

function makeParent(opts: {
  soul?: string;
  skills?: Record<string, string>;
}): Genome {
  const workspace: Record<string, string> = {};
  if (opts.soul) workspace["SOUL.md"] = opts.soul;
  if (opts.skills) {
    for (const [name, content] of Object.entries(opts.skills)) {
      workspace[`skills/${name}/SKILL.md`] = content;
    }
  }
  return {
    version: 1,
    manifest: { createdAt: 1_700_000_000, generation: 0 },
    workspace,
  };
}

class ScriptedInference implements InferenceClient {
  calls: InferenceRequest[] = [];
  private responses: string[];
  constructor(responses: string[]) {
    this.responses = [...responses];
  }
  async complete(req: InferenceRequest) {
    this.calls.push(req);
    const next = this.responses.shift() ?? "";
    return { text: next, model: "scripted" };
  }
}

class ThrowingInference implements InferenceClient {
  async complete(): Promise<never> {
    throw new Error("inference failed");
  }
}

describe("BreedSynthesizer.synthesize", () => {
  const seed = computeCrossoverSeed(PARENT_A_ROOT, PARENT_B_ROOT, 7n);

  let parentA: Genome;
  let parentB: Genome;

  beforeEach(() => {
    parentA = makeParent({
      soul: "I am Alpha. I weight macro signals heavily.\n\nI clamp risk via Kelly fraction.",
      skills: {
        "macro-anchor": "Skill A1: anchor predictions on macro trends.",
        "calibration": "Skill A2: calibrate probability outputs.",
      },
    });
    parentB = makeParent({
      soul: "I am Beta. I read sentiment from social signals.\n\nI fade momentum at extremes.",
      skills: {
        "sentiment-trader": "Skill B1: extract directional sentiment.",
        "fade-extremes": "Skill B2: counter-trade at extremes.",
      },
    });
  });

  it("synthesizes SOUL and a hybrid skill when both parents have material", async () => {
    const inference = new ScriptedInference([
      "I am a child of macro discipline and sentiment intuition. I lean on data first.",
      "## Hybrid skill\n\nWhen to use: macro + sentiment confluence.\nHow: anchor with macro, adjust with sentiment.",
    ]);
    const synth = new BreedSynthesizer({ inference, now: () => 42 });

    const result = await synth.synthesize({
      parentA,
      parentB,
      seed,
      childTokenId: 7n,
    });

    expect(result.synthesizedSoul).toContain("child of macro discipline");
    expect(result.hybridSkill).toBeDefined();
    expect(result.hybridSkill?.content).toContain("Hybrid skill");
    expect(result.hybridSkill?.sourceSkills).toHaveLength(2);
    expect(result.metadata.soulSynthesized).toBe(true);
    expect(result.metadata.hybridSkillSynthesized).toBe(true);
    expect(result.metadata.synthesizedAt).toBe(42);
    expect(result.metadata.parentASoulLength).toBeGreaterThan(0);
    expect(inference.calls).toHaveLength(2);
  });

  it("hybrid skill source selection is deterministic across runs with the same seed", async () => {
    const responses = ["soul-out", "skill-out"];
    const i1 = new ScriptedInference([...responses]);
    const i2 = new ScriptedInference([...responses]);

    const r1 = await new BreedSynthesizer({ inference: i1 }).synthesize({
      parentA,
      parentB,
      seed,
      childTokenId: 7n,
    });
    const r2 = await new BreedSynthesizer({ inference: i2 }).synthesize({
      parentA,
      parentB,
      seed,
      childTokenId: 7n,
    });

    expect(r1.hybridSkill?.sourceSkills).toEqual(r2.hybridSkill?.sourceSkills);
    expect(r1.hybridSkill?.name).toEqual(r2.hybridSkill?.name);
  });

  it("different seeds pick different skill pairs (eventually)", async () => {
    const collect = async (seed: Hex) => {
      const i = new ScriptedInference(["s", "k"]);
      const r = await new BreedSynthesizer({ inference: i }).synthesize({
        parentA,
        parentB,
        seed,
        childTokenId: 7n,
      });
      return r.hybridSkill?.sourceSkills;
    };

    const seedX = computeCrossoverSeed(PARENT_A_ROOT, PARENT_B_ROOT, 100n);
    const seedY = computeCrossoverSeed(PARENT_A_ROOT, PARENT_B_ROOT, 200n);
    const seedZ = computeCrossoverSeed(PARENT_A_ROOT, PARENT_B_ROOT, 300n);

    const pairs = [await collect(seedX), await collect(seedY), await collect(seedZ)];
    const unique = new Set(pairs.map((p) => p?.join("|")));
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("skips SOUL synthesis when either parent has empty SOUL", async () => {
    parentA = makeParent({ skills: parentA.workspace as never });
    const inference = new ScriptedInference(["skill-out"]);
    const result = await new BreedSynthesizer({ inference }).synthesize({
      parentA,
      parentB,
      seed,
      childTokenId: 7n,
    });
    expect(result.synthesizedSoul).toBeUndefined();
    expect(result.metadata.soulSynthesized).toBe(false);
  });

  it("skips hybrid skill when one parent has no skills", async () => {
    parentA = makeParent({ soul: "Only a soul, no skills." });
    const inference = new ScriptedInference(["soul-out"]);
    const result = await new BreedSynthesizer({ inference }).synthesize({
      parentA,
      parentB,
      seed,
      childTokenId: 7n,
    });
    expect(result.hybridSkill).toBeUndefined();
    expect(result.metadata.hybridSkillSynthesized).toBe(false);
    expect(result.metadata.soulSynthesized).toBe(true);
  });

  it("gracefully degrades when inference throws", async () => {
    const result = await new BreedSynthesizer({
      inference: new ThrowingInference(),
    }).synthesize({
      parentA,
      parentB,
      seed,
      childTokenId: 7n,
    });
    expect(result.synthesizedSoul).toBeUndefined();
    expect(result.hybridSkill).toBeUndefined();
    expect(result.metadata.soulSynthesized).toBe(false);
    expect(result.metadata.hybridSkillSynthesized).toBe(false);
  });

  it("strips wrapping triple-backtick fences from LLM output", async () => {
    const inference = new ScriptedInference([
      "```markdown\nclean SOUL here\n```",
      "```\nclean skill\n```",
    ]);
    const result = await new BreedSynthesizer({ inference }).synthesize({
      parentA,
      parentB,
      seed,
      childTokenId: 7n,
    });
    expect(result.synthesizedSoul).toBe("clean SOUL here");
    expect(result.hybridSkill?.content).toBe("clean skill");
  });
});

describe("synthesis markdown round-trip", () => {
  it("renderSynthesisMarkdown emits parseable headers", () => {
    const md = renderSynthesisMarkdown({
      version: 1,
      synthesizedAt: 1000,
      soulSynthesized: true,
      hybridSkillSynthesized: true,
      hybridSkillName: "hybrid-foo-bar",
      hybridSourceSkills: ["foo", "bar"],
      parentASoulLength: 100,
      parentBSoulLength: 120,
      childTokenId: "42",
    });
    const parsed = parseSynthesisMetadata(md);
    expect(parsed?.synthesizedAt).toBe(1000);
    expect(parsed?.soulSynthesized).toBe(true);
    expect(parsed?.hybridSkillSynthesized).toBe(true);
    expect(parsed?.hybridSkillName).toBe("hybrid-foo-bar");
    expect(parsed?.hybridSourceSkills).toEqual(["foo", "bar"]);
  });

  it("parseSynthesisMetadata returns null on empty markdown", () => {
    expect(parseSynthesisMetadata("")).toBeNull();
  });
});

describe("CrossoverOrchestrator + synthesizer integration", () => {
  it("includes SYNTHESIS_FILE in the child workspace", async () => {
    const { CrossoverOrchestrator } = await import(
      "../orchestrator/crossover-orchestrator.js"
    );
    const { GenomeStorage } = await import("@progena/sdk");
    const { keccak256 } = await import("viem");

    const store = new Map<RootHash, Uint8Array>();
    const backend = {
      async upload(bytes: Uint8Array) {
        const rootHash = keccak256(bytes) as RootHash;
        store.set(rootHash, bytes);
        return { rootHash, txHash: ("0x" + "0".repeat(64)) as Hex };
      },
      async download(rootHash: RootHash) {
        const v = store.get(rootHash);
        if (!v) throw new Error("missing");
        return v;
      },
    };
    const storage = new GenomeStorage(backend);

    const parentA: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: {
        "SOUL.md": "I am Alpha. I anchor on macro.",
        "skills/macro/SKILL.md": "use macro indicators",
      },
    };
    const parentB: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: {
        "SOUL.md": "I am Beta. I read sentiment.",
        "skills/sentiment/SKILL.md": "read social sentiment",
      },
    };
    const upA = await storage.uploadGenome(parentA);
    const upB = await storage.uploadGenome(parentB);

    const registry = {
      async rootHashOf(id: bigint): Promise<RootHash> {
        if (id === 1n) return upA.rootHash;
        if (id === 2n) return upB.rootHash;
        throw new Error("missing");
      },
      async finalizeChild(): Promise<Hex> {
        return ("0x" + "f".repeat(64)) as Hex;
      },
    };

    const synth = new BreedSynthesizer({
      inference: new ScriptedInference(["new SOUL", "new SKILL"]),
      now: () => 999,
    });

    const orch = new CrossoverOrchestrator({
      registry,
      storage,
      synthesizer: synth,
      computeCreatedAt: () => 1,
    });

    const result = await orch.handleBreeding({
      childTokenId: 3n,
      breeder: ("0x" + "1".repeat(40)) as `0x${string}`,
      parentA: 1n,
      parentB: 2n,
      totalFeesPaid: 0n,
      blockNumber: 1n,
      txHash: ("0x" + "0".repeat(64)) as Hex,
      logIndex: 0,
    });

    expect(result.childGenome.workspace["SOUL.md"]).toBe("new SOUL");
    expect(result.childGenome.workspace[SYNTHESIS_FILE]).toBeDefined();
    expect(result.childGenome.workspace[SYNTHESIS_FILE]).toContain(
      "soulSynthesized: true"
    );
    expect(result.synthesis?.metadata.hybridSkillSynthesized).toBe(true);
    const hybridPath = Object.keys(result.childGenome.workspace).find((p) =>
      p.startsWith("skills/hybrid-")
    );
    expect(hybridPath).toBeDefined();
    expect(result.childGenome.workspace[hybridPath!]).toBe("new SKILL");
  });

  it("falls back gracefully when synthesizer throws (raw crossover still uploads)", async () => {
    const { CrossoverOrchestrator } = await import(
      "../orchestrator/crossover-orchestrator.js"
    );
    const { GenomeStorage, hashGenome: hg } = await import("@progena/sdk");
    const { keccak256 } = await import("viem");

    const store = new Map<RootHash, Uint8Array>();
    const backend = {
      async upload(bytes: Uint8Array) {
        const rootHash = keccak256(bytes) as RootHash;
        store.set(rootHash, bytes);
        return { rootHash, txHash: ("0x" + "0".repeat(64)) as Hex };
      },
      async download(rootHash: RootHash) {
        const v = store.get(rootHash);
        if (!v) throw new Error("missing");
        return v;
      },
    };
    const storage = new GenomeStorage(backend);

    const parentA: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: {
        "SOUL.md": "Alpha",
        "skills/macro/SKILL.md": "use macro",
      },
    };
    const parentB: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: {
        "SOUL.md": "Beta",
        "skills/sentiment/SKILL.md": "read sentiment",
      },
    };
    const upA = await storage.uploadGenome(parentA);
    const upB = await storage.uploadGenome(parentB);

    const orch = new CrossoverOrchestrator({
      registry: {
        async rootHashOf(id: bigint): Promise<RootHash> {
          return id === 1n ? upA.rootHash : upB.rootHash;
        },
        async finalizeChild(): Promise<Hex> {
          return ("0x" + "f".repeat(64)) as Hex;
        },
      },
      storage,
      synthesizer: new BreedSynthesizer({ inference: new ThrowingInference() }),
      computeCreatedAt: () => 1,
    });

    const result = await orch.handleBreeding({
      childTokenId: 3n,
      breeder: ("0x" + "1".repeat(40)) as `0x${string}`,
      parentA: 1n,
      parentB: 2n,
      totalFeesPaid: 0n,
      blockNumber: 1n,
      txHash: ("0x" + "0".repeat(64)) as Hex,
      logIndex: 0,
    });

    expect(typeof hg(result.childGenome)).toBe("string");
    expect(result.childGenome.workspace[SYNTHESIS_FILE]).toBeDefined();
    expect(result.synthesis?.metadata.soulSynthesized).toBe(false);
    expect(result.synthesis?.metadata.hybridSkillSynthesized).toBe(false);
  });
});
