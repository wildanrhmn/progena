import type { Genome } from "@progena/sdk";
import { SOUL_FILE, TOOLS_FILE, isSkillPath } from "@progena/sdk";

const SYNTHESIS_FILE = "SYNTHESIS.md";

export type ChildTraits = {
  version: 1;
  skills: string[];
  tools: string[];
  soulPreview: string;
  generation: number;
  synthesizedSoul?: boolean;
  hybridSkillName?: string;
  hybridSourceSkills?: [string, string];
};

function parseSynthesisHeaders(markdown: string | undefined): {
  soulSynthesized: boolean;
  hybridSkillName?: string;
  hybridSourceSkills?: [string, string];
} {
  if (!markdown) return { soulSynthesized: false };
  const re = /<!--\s*([a-zA-Z]+):\s*(.+?)\s*-->/g;
  const fields: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    fields[m[1]!] = m[2]!;
  }
  const soulSynthesized = fields.soulSynthesized === "true";
  const hybridSkillName =
    fields.hybridSkillSynthesized === "true" ? fields.hybridSkillName : undefined;
  const sources = fields.hybridSourceSkills?.split(",");
  const hybridSourceSkills =
    sources && sources.length === 2 ? ([sources[0]!, sources[1]!] as [string, string]) : undefined;
  return { soulSynthesized, hybridSkillName, hybridSourceSkills };
}

export function buildTraitsFromGenome(genome: Genome): ChildTraits {
  const skills: string[] = [];
  for (const path of Object.keys(genome.workspace).filter(isSkillPath).sort()) {
    const segments = path.split("/");
    const name = segments[1] ?? path;
    skills.push(name);
  }

  const toolsRaw = genome.workspace[TOOLS_FILE];
  const tools = toolsRaw
    ? toolsRaw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  const soul = (genome.workspace[SOUL_FILE] ?? "").trim();
  const soulPreview = soul.slice(0, 320);

  const synthesis = parseSynthesisHeaders(genome.workspace[SYNTHESIS_FILE]);

  return {
    version: 1,
    skills,
    tools,
    soulPreview,
    generation: genome.manifest.generation,
    synthesizedSoul: synthesis.soulSynthesized || undefined,
    hybridSkillName: synthesis.hybridSkillName,
    hybridSourceSkills: synthesis.hybridSourceSkills,
  };
}

export function serializeTraits(traits: ChildTraits): string {
  return JSON.stringify(traits);
}
