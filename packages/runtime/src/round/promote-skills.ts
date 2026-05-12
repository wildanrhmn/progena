import {
  getContract,
  type Account,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { agentMemoryAbi, agentMetadataAbi } from "@progena/sdk";
import type { StorageBackend } from "@progena/sdk";
import type { Logger } from "../lib/logger.js";
import type { InferenceClient } from "./inference.js";
import { deserializeShard } from "./memory-accumulator.js";

export const SKILL_PROMOTION_SYSTEM_PROMPT =
  "You are a skill-promotion analyst for Progena. You inspect an agent's recent prediction-round memory shards (which include tool-call traces) and decide whether the agent has demonstrated a coherent, repeatable BEHAVIOR or COMPETENCE that should be promoted into its capability set as an *earned* skill.\n\nWhat counts as a promotable skill:\n- A consistent research approach across rounds (e.g. 'always uses web_search to gather current data before predicting price questions')\n- A consistent calibration habit (e.g. 'reliably clamps predictions to [50, 150] on uncertain factual questions, avoiding the 5000 mid-point trap')\n- A repeated domain focus (e.g. 'consistently engages with crypto-price questions using a search-first methodology')\n- A specific corrective lesson that's been internalized (e.g. 'after learning that extreme predictions get penalized, now anchors closer to 5000')\n\nGuidelines:\n- Require evidence from AT LEAST 2 rounds. A pattern visible across 2-3 rounds is enough if it's clearly the same behavior.\n- Outcome quality matters but isn't the only signal — a CONSISTENT METHODOLOGY is itself a skill, even if the oracle disagrees occasionally.\n- The skill name should describe what the agent does, not just a domain ('earned-search-before-price-prediction', not 'earned-crypto').\n- Don't promote on a single round.\n- Don't promote contradictory patterns (e.g. predicted 50 in some rounds, 9500 in others, with no theme).\n\nOutput in this exact format, no preamble:\n\nDECISION: yes|no\nSKILL_NAME: <kebab-case-name, max 64 chars, prefix with 'earned-'>\nREASONING: <one sentence, max 200 chars, the behavioral pattern that justified the promotion>\nSKILL_MARKDOWN:\n<the SKILL.md content — open with one-line description, then When to use:/How: sections, under 400 words>\n\nIf DECISION is no, omit SKILL_NAME, REASONING, and SKILL_MARKDOWN.";

export type Promotion = {
  skillName: string;
  reasoning: string;
  markdown: string;
};

export function parsePromotion(raw: string): Promotion | null {
  const text = raw.trim();
  const decisionMatch = /^DECISION:\s*(yes|no)/im.exec(text);
  if (!decisionMatch || decisionMatch[1]!.toLowerCase() !== "yes") return null;

  const nameMatch = /^SKILL_NAME:\s*(.+)$/im.exec(text);
  const reasoningMatch = /^REASONING:\s*(.+)$/im.exec(text);
  const markdownMatch = /SKILL_MARKDOWN:\s*\n([\s\S]*)$/im.exec(text);
  if (!nameMatch || !reasoningMatch || !markdownMatch) return null;

  const skillName = nameMatch[1]!
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  if (!skillName.startsWith("earned-")) return null;
  const reasoning = reasoningMatch[1]!.trim().slice(0, 500);
  const markdown = markdownMatch[1]!.trim();
  if (!skillName || !reasoning || !markdown) return null;
  return { skillName, reasoning, markdown };
}

export interface PromoteSkillsContext {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  chain: Chain;
  storage: StorageBackend;
  inference: InferenceClient;
  agentMemoryAddress: `0x${string}`;
  agentMetadataAddress: `0x${string}`;
  logger?: Logger;
}

export interface PromoteSkillsInput {
  agentIds: bigint[];
  earnedInRound: bigint;
  lookback?: number;
}

export interface PromotedSkill {
  agentId: bigint;
  skillName: string;
  reasoning: string;
  rootHash: `0x${string}`;
  txHash: Hex;
}

export interface PromoteSkillsResult {
  promoted: PromotedSkill[];
  declined: Array<{ agentId: bigint; reason: string }>;
  failed: Array<{ agentId: bigint; error: string }>;
}

export async function promoteSkills(
  input: PromoteSkillsInput,
  ctx: PromoteSkillsContext
): Promise<PromoteSkillsResult> {
  const lookback = input.lookback ?? 5;
  const log = ctx.logger?.child?.({
    component: "promote-skills",
    earnedInRound: String(input.earnedInRound),
  });

  const memoryContract = getContract({
    address: ctx.agentMemoryAddress,
    abi: agentMemoryAbi,
    client: { public: ctx.publicClient },
  });
  const metaContract = getContract({
    address: ctx.agentMetadataAddress,
    abi: agentMetadataAbi,
    client: { public: ctx.publicClient, wallet: ctx.walletClient },
  });

  const promoted: PromotedSkill[] = [];
  const declined: PromoteSkillsResult["declined"] = [];
  const failed: PromoteSkillsResult["failed"] = [];

  for (const agentId of input.agentIds) {
    try {
      const totalShards = (await memoryContract.read.shardCountOf([agentId])) as bigint;
      const take = Math.min(lookback, Number(totalShards));
      if (take < 2) {
        declined.push({ agentId, reason: `only ${totalShards} shards, need >= 2` });
        continue;
      }

      const shardSummaries: string[] = [];
      for (let i = 0; i < take; i++) {
        const idx = totalShards - 1n - BigInt(i);
        const rootHash = (await memoryContract.read.shardAt([agentId, idx])) as `0x${string}`;
        try {
          const bytes = await ctx.storage.download(rootHash);
          const shard = deserializeShard(bytes);
          const toolPattern = (shard.toolCalls ?? [])
            .map((tc) => `${tc.tool}(${JSON.stringify(tc.args).slice(0, 60)})`)
            .join(", ");
          const lines = [
            `[shard ${idx}] round=${shard.roundId} prediction=${shard.myPrediction} outcome=${shard.actualOutcome} delta=${shard.scoreDelta}`,
            `  lesson: "${shard.lesson}"`,
          ];
          if (toolPattern) lines.push(`  tools_used: ${toolPattern}`);
          if (shard.openclawReasoning) {
            const oc = shard.openclawReasoning.replace(/\s+/g, " ").slice(0, 220);
            lines.push(`  openclaw_pass1: "${oc}"`);
          }
          if (shard.reasoningPreview) {
            const preview = shard.reasoningPreview.replace(/\s+/g, " ").slice(0, 200);
            lines.push(`  pass2_reasoning: "${preview}"`);
          }
          shardSummaries.push(lines.join("\n"));
        } catch (err) {
          log?.warn?.("failed to download shard", {
            agentId: String(agentId),
            rootHash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (shardSummaries.length < 2) {
        declined.push({
          agentId,
          reason: `only ${shardSummaries.length} downloadable shards`,
        });
        continue;
      }

      const userPrompt = [
        `Agent token #${agentId} has accumulated ${totalShards} memory shards. Most recent ${shardSummaries.length}:`,
        ``,
        ...shardSummaries,
        ``,
        `Decide whether to promote a new earned skill now.`,
      ].join("\n");

      log?.info?.("asking 0G Compute for promotion decision", {
        agentId: String(agentId),
        shards: shardSummaries.length,
      });

      const response = await ctx.inference.complete({
        systemPrompt: SKILL_PROMOTION_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.3,
        maxTokens: 700,
      });

      const promotion = parsePromotion(response.text);
      if (!promotion) {
        declined.push({ agentId, reason: "LLM decided NO" });
        continue;
      }

      const already = (await metaContract.read.hasEarnedSkill([
        agentId,
        promotion.skillName,
      ])) as boolean;
      if (already) {
        declined.push({ agentId, reason: `already earned ${promotion.skillName}` });
        continue;
      }

      const skillBytes = new TextEncoder().encode(promotion.markdown);
      const upload = await ctx.storage.upload(skillBytes);
      log?.info?.("uploaded skill markdown to 0G Storage", {
        agentId: String(agentId),
        skillName: promotion.skillName,
        rootHash: upload.rootHash,
      });

      const txHash = (await metaContract.write.recordEarnedSkill(
        [agentId, promotion.skillName, upload.rootHash, input.earnedInRound, promotion.reasoning],
        { account: ctx.account, chain: ctx.chain }
      )) as Hex;
      await ctx.publicClient
        .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
        .catch(() => undefined);

      promoted.push({
        agentId,
        skillName: promotion.skillName,
        reasoning: promotion.reasoning,
        rootHash: upload.rootHash,
        txHash,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.error?.("skill promotion failed (continuing)", {
        agentId: String(agentId),
        error: message,
      });
      failed.push({ agentId, error: message.split("\n")[0] ?? message });
    }
  }

  return { promoted, declined, failed };
}
