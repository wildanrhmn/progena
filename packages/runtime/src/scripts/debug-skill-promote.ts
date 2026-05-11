import "dotenv/config";
import { createPublicClient, getContract, http } from "viem";
import { agentMemoryAbi, zgMainnet } from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { createOpenClawInferenceClient } from "../round/inference.js";
import { deserializeShard } from "../round/memory-accumulator.js";
import { bigintArg } from "./args.js";

const SKILL_PROMOTION_SYSTEM_PROMPT =
  "You are a skill-promotion analyst for Progena. You inspect an agent's recent prediction-round memory shards (which include tool-call traces) and decide whether the agent has demonstrated a coherent, repeatable BEHAVIOR or COMPETENCE that should be promoted into its capability set as an *earned* skill.\n\nWhat counts as a promotable skill:\n- A consistent research approach across rounds (e.g. 'always uses web_search to gather current data before predicting price questions')\n- A consistent calibration habit (e.g. 'reliably clamps predictions to [50, 150] on uncertain factual questions, avoiding the 5000 mid-point trap')\n- A repeated domain focus (e.g. 'consistently engages with crypto-price questions using a search-first methodology')\n- A specific corrective lesson that's been internalized (e.g. 'after learning that extreme predictions get penalized, now anchors closer to 5000')\n\nGuidelines:\n- Require evidence from AT LEAST 2 rounds. A pattern visible across 2-3 rounds is enough if it's clearly the same behavior.\n- Outcome quality matters but isn't the only signal — a CONSISTENT METHODOLOGY is itself a skill, even if the oracle disagrees occasionally.\n- The skill name should describe what the agent does, not just a domain ('earned-search-before-price-prediction', not 'earned-crypto').\n- Don't promote on a single round.\n- Don't promote contradictory patterns (e.g. predicted 50 in some rounds, 9500 in others, with no theme).\n\nOutput in this exact format, no preamble:\n\nDECISION: yes|no\nSKILL_NAME: <kebab-case-name, max 64 chars, prefix with 'earned-'>\nREASONING: <one sentence, max 200 chars, the behavioral pattern that justified the promotion>\nSKILL_MARKDOWN:\n<the SKILL.md content — open with one-line description, then When to use:/How: sections, under 400 words>\n\nIf DECISION is no, omit SKILL_NAME, REASONING, and SKILL_MARKDOWN.";

async function main(): Promise<void> {
  const agentId = bigintArg("agent");

  const config = loadConfig();
  const logger = createLogger({
    level: "info",
    bindings: { service: "debug-skill-promote", network: config.network },
  });

  const publicClient = createPublicClient({
    chain: zgMainnet,
    transport: http(config.rpcUrl),
  });
  const memoryContract = getContract({
    address: config.addresses.agentMemory,
    abi: agentMemoryAbi,
    client: { public: publicClient },
  });
  const storage = createZgStorageBackend({
    rpcUrl: config.rpcUrl,
    indexerUrl: config.indexerUrl,
    privateKey: config.genomeWriterPrivateKey,
  });
  const inference = createOpenClawInferenceClient({ logger });

  const total = (await memoryContract.read.shardCountOf([agentId])) as bigint;
  const take = Math.min(5, Number(total));
  console.log(`\nagent ${agentId} has ${total} shards, taking last ${take}\n`);

  const summaries: string[] = [];
  for (let i = 0; i < take; i++) {
    const idx = total - 1n - BigInt(i);
    const rootHash = (await memoryContract.read.shardAt([agentId, idx])) as `0x${string}`;
    try {
      const bytes = await storage.download(rootHash);
      const shard = deserializeShard(bytes);
      const toolPattern = (shard.toolCalls ?? [])
        .map((tc) => `${tc.tool}(${JSON.stringify(tc.args).slice(0, 60)})`)
        .join(", ");
      const lines = [
        `[shard ${idx}] round=${shard.roundId} prediction=${shard.myPrediction} outcome=${shard.actualOutcome} delta=${shard.scoreDelta}`,
        `  lesson: "${shard.lesson}"`,
      ];
      if (toolPattern) lines.push(`  tools_used: ${toolPattern}`);
      if (shard.reasoningPreview) {
        const preview = shard.reasoningPreview.replace(/\s+/g, " ").slice(0, 200);
        lines.push(`  reasoning: "${preview}"`);
      }
      const summary = lines.join("\n");
      summaries.push(summary);
      console.log(summary);
    } catch (err) {
      console.log(`  [shard ${idx}] FAILED to download ${rootHash}`);
    }
  }

  if (summaries.length < 2) {
    console.log("Not enough shards");
    return;
  }

  const userPrompt = [
    `Agent token #${agentId} has accumulated ${total} memory shards. Most recent ${summaries.length}:`,
    ``,
    ...summaries,
    ``,
    `Decide whether to promote a new earned skill now.`,
  ].join("\n");

  console.log("\n=== SENDING TO 0G COMPUTE ===\n");
  console.log("---USER PROMPT---");
  console.log(userPrompt);
  console.log("---END---\n");

  const response = await inference.complete({
    systemPrompt: SKILL_PROMOTION_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
    maxTokens: 700,
  });

  console.log("\n=== RAW MODEL RESPONSE ===");
  console.log(response.text);
  console.log("=== END RAW ===\n");

  console.log("\n=== Parser inspection ===");
  const decisionMatch = /^DECISION:\s*(yes|no)/im.exec(response.text);
  console.log("decision regex match:", decisionMatch?.[0] ?? "NO MATCH");
  console.log("decision value:", decisionMatch?.[1] ?? "(none)");
  const nameMatch = /^SKILL_NAME:\s*(.+)$/im.exec(response.text);
  console.log("skill_name match:", nameMatch?.[1] ?? "(none)");
  const reasoningMatch = /^REASONING:\s*(.+)$/im.exec(response.text);
  console.log("reasoning match:", reasoningMatch?.[1]?.slice(0, 100) ?? "(none)");
  const markdownMatch = /SKILL_MARKDOWN:\s*\n([\s\S]*)$/im.exec(response.text);
  console.log("markdown match:", markdownMatch?.[1] ? `${markdownMatch[1].length} chars` : "(none)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
