import type { Genome } from "@progena/sdk";
import { SOUL_FILE, AGENTS_FILE, TOOLS_FILE, isSkillPath } from "@progena/sdk";

export type ChildTraits = {
  version: 1;
  skills: string[];
  tools: string[];
  soulPreview: string;
  generation: number;
};

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

  return {
    version: 1,
    skills,
    tools,
    soulPreview,
    generation: genome.manifest.generation,
  };
}

export function serializeTraits(traits: ChildTraits): string {
  return JSON.stringify(traits);
}
