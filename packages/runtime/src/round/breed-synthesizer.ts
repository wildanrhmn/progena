import type { Hex } from "viem";
import {
  DeterministicRNG,
  TOOLS_FILE,
  isSkillPath,
  skillNameFromPath,
  SOUL_FILE,
  type Genome,
} from "@progena/sdk";
import type { InferenceClient } from "./inference.js";
import type { Logger } from "../lib/logger.js";

export const SYNTHESIS_FILE = "SYNTHESIS.md";

export interface SynthesisInput {
  parentA: Genome;
  parentB: Genome;
  parentAName?: string;
  parentBName?: string;
  seed: Hex;
  childTokenId: bigint;
}

export interface HybridSkill {
  name: string;
  content: string;
  sourceSkills: [string, string];
}

export interface SynthesizedTool {
  name: string;
  description: string;
  sourceTools: string[];
}

export interface SynthesisMetadata {
  version: 1;
  synthesizedAt: number;
  soulSynthesized: boolean;
  hybridSkillSynthesized: boolean;
  hybridSkillName?: string;
  hybridSourceSkills?: [string, string];
  synthesizedToolName?: string;
  synthesizedToolSourceTools?: string[];
  parentASoulLength: number;
  parentBSoulLength: number;
  childTokenId: string;
}

export interface SynthesisResult {
  synthesizedSoul?: string;
  hybridSkill?: HybridSkill;
  synthesizedTool?: SynthesizedTool;
  metadata: SynthesisMetadata;
}

export interface BreedSynthesizerOptions {
  inference: InferenceClient;
  logger?: Logger;
  now?: () => number;
}

const SOUL_SYSTEM_PROMPT =
  "You are a synthesizer of digital identities. Two parent agents are breeding to create a new child agent on the Progena platform. Your job is to author the child's SOUL.md — a first-person identity document that blends both parents into a coherent new individual.\n\nRules:\n- Write in first person (\"I am…\", \"I value…\")\n- 3-5 short paragraphs, each focused on a specific value, philosophy, or behavioral trait\n- The child should inherit recognizable themes from both parents but speak with ONE coherent voice — never a collage or list\n- Avoid mentioning parents by name; the child is its own agent now\n- Be specific and grounded — concrete values and behaviors, not vague platitudes\n- Output ONLY the markdown content of SOUL.md, no preamble, no triple-backticks, no commentary";

const SKILL_SYSTEM_PROMPT =
  "You are a synthesizer of agent skills. Two parent agents each contribute one skill markdown. Your job is to fuse them into a single hybrid skill that combines their methods in a useful, coherent way.\n\nRules:\n- Output a SKILL.md file in plain markdown\n- Open with a one-line description of what the hybrid skill does\n- Include 'When to use:' and 'How:' sections with concrete operational instructions an LLM agent could follow\n- Don't merely concatenate the two inputs — actually synthesize a new method that leverages both\n- Stay under ~400 words\n- Output ONLY the markdown, no preamble, no triple-backticks";

const TOOL_SYSTEM_PROMPT =
  "You are a synthesizer of agent tools. Two parent agents each list tools they prefer in their TOOLS.md. Your job is to invent ONE new tool name that combines or specializes existing parent tool capabilities — a conceptual tool the child will list in its own TOOLS.md.\n\nThe canonical tool primitives the runtime can execute today are:\n  - web_search (research the web)\n  - fetch_token_price (token prices via CoinGecko)\n  - read_on_chain (read 0G Chain contract state)\n  - fetch_market_state (read PredictionRound state)\n\nThe child's new tool name will be aliased by the runtime to one of these primitives (or remain prompt-only if no alias matches), so pick a name that hints at its underlying purpose. Examples: 'onchain-trace-correlator', 'sentiment-priced-divergence', 'lineage-explorer'.\n\nOutput in this EXACT format, no preamble, no extra lines:\n\nTOOL_NAME: <kebab-case-name, max 32 chars>\nTOOL_DESCRIPTION: <one sentence, max 200 chars, what this tool does and which parent tools it draws from>\nSOURCE_TOOLS: <comma-separated list of parent tool names this fuses>";

export class BreedSynthesizer {
  constructor(private readonly opts: BreedSynthesizerOptions) {}

  async synthesize(input: SynthesisInput): Promise<SynthesisResult> {
    const log = this.opts.logger?.child({
      component: "breed-synthesizer",
      childTokenId: String(input.childTokenId),
    });

    const rng = DeterministicRNG.fromHex(input.seed);

    const parentASoul = (input.parentA.workspace[SOUL_FILE] ?? "").trim();
    const parentBSoul = (input.parentB.workspace[SOUL_FILE] ?? "").trim();

    let synthesizedSoul: string | undefined;
    if (parentASoul.length > 0 && parentBSoul.length > 0) {
      log?.info("synthesizing SOUL via 0G Compute", {
        parentALen: parentASoul.length,
        parentBLen: parentBSoul.length,
      });
      const userPrompt = [
        "Parent A's SOUL.md:",
        "---",
        parentASoul,
        "---",
        "",
        "Parent B's SOUL.md:",
        "---",
        parentBSoul,
        "---",
        "",
        "Synthesize the child's SOUL.md now. Remember: one coherent voice, not a collage.",
      ].join("\n");
      try {
        const response = await this.opts.inference.complete({
          systemPrompt: SOUL_SYSTEM_PROMPT,
          userPrompt,
          temperature: 0.7,
          maxTokens: 800,
        });
        const text = stripFences(response.text).trim();
        if (text.length > 0) synthesizedSoul = text;
      } catch (err) {
        log?.warn("SOUL synthesis failed, falling back to inherited SOUL", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      log?.info("skipping SOUL synthesis — at least one parent has empty SOUL");
    }

    let hybridSkill: HybridSkill | undefined;
    const aSkills = collectSkills(input.parentA);
    const bSkills = collectSkills(input.parentB);
    if (aSkills.length > 0 && bSkills.length > 0) {
      const aIdx = rng.nextBoundedInt(aSkills.length);
      const bIdx = rng.nextBoundedInt(bSkills.length);
      const aSkill = aSkills[aIdx]!;
      const bSkill = bSkills[bIdx]!;
      log?.info("synthesizing hybrid skill via 0G Compute", {
        from: [aSkill.name, bSkill.name],
      });
      const userPrompt = [
        `Skill from Parent A — "${aSkill.name}":`,
        "---",
        aSkill.content,
        "---",
        "",
        `Skill from Parent B — "${bSkill.name}":`,
        "---",
        bSkill.content,
        "---",
        "",
        "Fuse these into a hybrid SKILL.md now.",
      ].join("\n");
      try {
        const response = await this.opts.inference.complete({
          systemPrompt: SKILL_SYSTEM_PROMPT,
          userPrompt,
          temperature: 0.7,
          maxTokens: 800,
        });
        const text = stripFences(response.text).trim();
        if (text.length > 0) {
          const name = hybridName(aSkill.name, bSkill.name);
          hybridSkill = {
            name,
            content: text,
            sourceSkills: [aSkill.name, bSkill.name],
          };
        }
      } catch (err) {
        log?.warn("hybrid skill synthesis failed, continuing without it", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      log?.info("skipping hybrid skill synthesis — at least one parent has no skills");
    }

    let synthesizedTool: SynthesizedTool | undefined;
    const aTools = parseToolList(input.parentA.workspace[TOOLS_FILE]);
    const bTools = parseToolList(input.parentB.workspace[TOOLS_FILE]);
    if (aTools.length > 0 && bTools.length > 0) {
      const userPrompt = [
        `Parent A's TOOLS.md (tools the parent prefers):`,
        aTools.map((t) => `  - ${t}`).join("\n"),
        ``,
        `Parent B's TOOLS.md:`,
        bTools.map((t) => `  - ${t}`).join("\n"),
        ``,
        `Synthesize a new tool name for the child now.`,
      ].join("\n");
      log?.info("synthesizing new tool via 0G Compute", {
        aCount: aTools.length,
        bCount: bTools.length,
      });
      try {
        const response = await this.opts.inference.complete({
          systemPrompt: TOOL_SYSTEM_PROMPT,
          userPrompt,
          temperature: 0.6,
          maxTokens: 200,
        });
        synthesizedTool = parseToolResponse(response.text);
      } catch (err) {
        log?.warn("tool synthesis failed, continuing without it", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      log?.info("skipping tool synthesis — at least one parent has no tools");
    }

    const metadata: SynthesisMetadata = {
      version: 1,
      synthesizedAt: this.now(),
      soulSynthesized: !!synthesizedSoul,
      hybridSkillSynthesized: !!hybridSkill,
      hybridSkillName: hybridSkill?.name,
      hybridSourceSkills: hybridSkill?.sourceSkills,
      synthesizedToolName: synthesizedTool?.name,
      synthesizedToolSourceTools: synthesizedTool?.sourceTools,
      parentASoulLength: parentASoul.length,
      parentBSoulLength: parentBSoul.length,
      childTokenId: String(input.childTokenId),
    };

    return { synthesizedSoul, hybridSkill, synthesizedTool, metadata };
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Math.floor(Date.now() / 1000);
  }
}

export function renderSynthesisMarkdown(meta: SynthesisMetadata): string {
  const lines: string[] = [];
  lines.push("<!-- progena-synthesis v1 -->");
  lines.push(`<!-- synthesizedAt: ${meta.synthesizedAt} -->`);
  lines.push(`<!-- soulSynthesized: ${meta.soulSynthesized} -->`);
  lines.push(`<!-- hybridSkillSynthesized: ${meta.hybridSkillSynthesized} -->`);
  if (meta.hybridSkillName) {
    lines.push(`<!-- hybridSkillName: ${meta.hybridSkillName} -->`);
  }
  if (meta.hybridSourceSkills) {
    lines.push(
      `<!-- hybridSourceSkills: ${meta.hybridSourceSkills.join(",")} -->`
    );
  }
  if (meta.synthesizedToolName) {
    lines.push(`<!-- synthesizedToolName: ${meta.synthesizedToolName} -->`);
  }
  if (meta.synthesizedToolSourceTools) {
    lines.push(
      `<!-- synthesizedToolSourceTools: ${meta.synthesizedToolSourceTools.join(",")} -->`
    );
  }
  lines.push("");
  lines.push("# Synthesis log");
  lines.push("");
  if (meta.soulSynthesized) {
    lines.push(
      "This agent's SOUL.md was authored by 0G Compute at breed time, blending both parents' identities into a coherent first-person voice rather than concatenating paragraphs."
    );
    lines.push("");
  }
  if (meta.hybridSkillSynthesized && meta.hybridSourceSkills) {
    const [a, b] = meta.hybridSourceSkills;
    lines.push(
      `The hybrid skill \`skills/${meta.hybridSkillName}/SKILL.md\` was authored by 0G Compute by fusing parent skills "${a}" and "${b}" into a single new method.`
    );
    lines.push("");
  }
  if (meta.synthesizedToolName) {
    const sources = meta.synthesizedToolSourceTools?.join(", ") ?? "parent tools";
    lines.push(
      `A new tool \`${meta.synthesizedToolName}\` was added to TOOLS.md, synthesized by 0G Compute from ${sources}.`
    );
    lines.push("");
  }
  if (!meta.soulSynthesized && !meta.hybridSkillSynthesized) {
    lines.push(
      "No AI synthesis ran for this child (one or both parents lacked the required source material)."
    );
  }
  return lines.join("\n");
}

export function parseSynthesisMetadata(markdown: string): SynthesisMetadata | null {
  const re = /<!--\s*([a-zA-Z]+):\s*(.+?)\s*-->/g;
  const fields: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    fields[m[1]!] = m[2]!;
  }
  if (Object.keys(fields).length === 0) return null;
  const synthesizedAt = Number(fields.synthesizedAt);
  if (!Number.isFinite(synthesizedAt)) return null;
  const soulSynthesized = fields.soulSynthesized === "true";
  const hybridSkillSynthesized = fields.hybridSkillSynthesized === "true";
  const hybridSkillName = fields.hybridSkillName;
  const hybridSourceSkills = fields.hybridSourceSkills?.split(",") as
    | [string, string]
    | undefined;
  const synthesizedToolName = fields.synthesizedToolName;
  const synthesizedToolSourceTools = fields.synthesizedToolSourceTools
    ?.split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    version: 1,
    synthesizedAt,
    soulSynthesized,
    hybridSkillSynthesized,
    hybridSkillName,
    hybridSourceSkills:
      hybridSourceSkills && hybridSourceSkills.length === 2
        ? hybridSourceSkills
        : undefined,
    synthesizedToolName,
    synthesizedToolSourceTools:
      synthesizedToolSourceTools && synthesizedToolSourceTools.length > 0
        ? synthesizedToolSourceTools
        : undefined,
    parentASoulLength: 0,
    parentBSoulLength: 0,
    childTokenId: "",
  };
}

function collectSkills(genome: Genome): Array<{ name: string; content: string }> {
  const out: Array<{ name: string; content: string }> = [];
  for (const path of Object.keys(genome.workspace).filter(isSkillPath).sort()) {
    const name = skillNameFromPath(path);
    if (!name) continue;
    const content = genome.workspace[path];
    if (!content || content.trim().length === 0) continue;
    out.push({ name, content });
  }
  return out;
}

function parseToolList(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseToolResponse(raw: string): SynthesizedTool | undefined {
  const cleaned = stripFences(raw).trim();
  const nameMatch = /^TOOL_NAME:\s*(.+)$/im.exec(cleaned);
  const descMatch = /^TOOL_DESCRIPTION:\s*(.+)$/im.exec(cleaned);
  const sourcesMatch = /^SOURCE_TOOLS:\s*(.+)$/im.exec(cleaned);
  if (!nameMatch || !descMatch) return undefined;
  const name = nameMatch[1]!
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  if (name.length === 0) return undefined;
  const description = descMatch[1]!.trim().slice(0, 240);
  const sourceTools =
    sourcesMatch && sourcesMatch[1]
      ? sourcesMatch[1]
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length > 0)
      : [];
  return { name, description, sourceTools };
}

function hybridName(a: string, b: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/^hybrid-/, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24);
  return `hybrid-${slug(a)}-${slug(b)}`.slice(0, 60);
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const firstNl = trimmed.indexOf("\n");
    const body = firstNl >= 0 ? trimmed.slice(firstNl + 1) : "";
    const end = body.lastIndexOf("```");
    if (end >= 0) return body.slice(0, end).trim();
  }
  return trimmed;
}
