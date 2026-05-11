import {
  AGENTS_FILE,
  SOUL_FILE,
  TOOLS_FILE,
  isSkillPath,
  type Genome,
} from "@progena/sdk";

export interface AgentContext {
  systemPrompt: string;
  toolList: string[];
  skillNames: string[];
}

export function toAgentContext(genome: Genome): AgentContext {
  const sections: string[] = [];

  const soul = genome.workspace[SOUL_FILE];
  if (soul && soul.trim().length > 0) {
    sections.push(soul.trim());
  }

  const agents = genome.workspace[AGENTS_FILE];
  if (agents && agents.trim().length > 0) {
    sections.push(`# Agents\n\n${agents.trim()}`);
  }

  const skillSections: string[] = [];
  const skillNames: string[] = [];
  const sortedPaths = Object.keys(genome.workspace).filter(isSkillPath).sort();
  for (const path of sortedPaths) {
    const content = genome.workspace[path];
    if (!content) continue;
    const segments = path.split("/");
    const name = segments[1] ?? path;
    skillNames.push(name);
    skillSections.push(`## Skill: ${name}\n\n${content.trim()}`);
  }
  if (skillSections.length > 0) {
    sections.push(`# Skills\n\n${skillSections.join("\n\n")}`);
  }

  const toolList = parseToolList(genome.workspace[TOOLS_FILE]);
  if (toolList.length > 0) {
    sections.push(`# Available tools\n\n${toolList.map((t) => `- ${t}`).join("\n")}`);
  }

  return {
    systemPrompt: sections.join("\n\n"),
    toolList,
    skillNames,
  };
}

export function buildPredictionUserPrompt(question: string, now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  const human = now.toUTCString().replace(/^[A-Z][a-z]{2}, /, "");
  return [
    `You are participating in a Progena prediction round.`,
    ``,
    `THE CURRENT REAL-WORLD DATE IS ${iso} (${human}). Do NOT default to your training-cutoff date when interpreting "today", "now", "current", or "recent" in the question. If you use a web_search tool, include "${iso}" or the current month/year in queries so the results are recent, not historical.`,
    ``,
    `Question: ${question.trim()}`,
    ``,
    `Reason briefly, then output your final answer on the LAST line in this exact format:`,
    `PREDICTION: <integer 0-10000>`,
    ``,
    `0 means certainly NO, 10000 means certainly YES, 5000 means uncertain.`,
    `Calibrate carefully. Symmetric scoring penalizes overconfidence.`,
  ].join("\n");
}

function parseToolList(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
