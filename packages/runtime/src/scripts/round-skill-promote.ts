import { join } from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  agentMemoryAbi,
  agentMetadataAbi,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import {
  createOpenClawInferenceClient,
  createStubInferenceClient,
  type InferenceClient,
} from "../round/inference.js";
import type { Logger } from "../lib/logger.js";
import { bigintArg, listArg } from "./args.js";
import { deserializeShard } from "../round/memory-accumulator.js";

const DEPLOYMENTS = {
  galileo: "deployments/galileo.json",
  mainnet: "deployments/mainnet.json",
} as const;

function loadAddresses(network: keyof typeof DEPLOYMENTS) {
  const file = join(
    new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    "contracts",
    DEPLOYMENTS[network]
  );
  const parsed = JSON.parse(readFileSync(file, "utf-8"));
  return {
    agentMetadata: parsed.contracts.AgentMetadata as Address,
  };
}

function openclawAvailable(bin = "openclaw"): boolean {
  try {
    execSync(`${bin} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function buildInference(logger: Logger): { client: InferenceClient; mode: string } {
  if (process.env.INFERENCE_MODE !== "stub" && openclawAvailable()) {
    return {
      client: createOpenClawInferenceClient({ logger }),
      mode: "OpenClaw → 0G Compute (via proxy)",
    };
  }
  return { client: createStubInferenceClient(), mode: "stub" };
}

const SKILL_PROMOTION_SYSTEM_PROMPT =
  "You are a skill-promotion analyst for Progena. You inspect an agent's recent prediction-round memory shards and decide whether the agent has demonstrated a coherent, repeatable skill that should be promoted into its capability set as an *earned* skill.\n\nRules:\n- Be CONSERVATIVE. Only promote a skill if there's clear evidence of a repeated competence across multiple rounds (e.g. consistently good calibration on macro questions, or consistent fading of sentiment extremes). One lucky round is not enough.\n- Output in this exact format, no preamble:\n\nDECISION: yes|no\nSKILL_NAME: <kebab-case-name, max 64 chars, prefix with 'earned-'>\nREASONING: <one sentence, max 200 chars, what pattern justified the promotion>\nSKILL_MARKDOWN:\n<the SKILL.md content — open with one-line description, then When to use:/How: sections, under 400 words>\n\nIf DECISION is no, omit SKILL_NAME, REASONING, and SKILL_MARKDOWN.";

type Promotion = {
  skillName: string;
  reasoning: string;
  markdown: string;
};

function parsePromotion(raw: string): Promotion | null {
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

  if (skillName.length === 0 || reasoning.length === 0 || markdown.length === 0) {
    return null;
  }

  return { skillName, reasoning, markdown };
}

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const agentIds = listArg("agents");
  const lookback = Number(process.env.SHARD_LOOKBACK ?? 5);

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-skill-promote", network: config.network, roundId: String(roundId) },
  });

  const network = config.network as keyof typeof DEPLOYMENTS;
  const addrs = loadAddresses(network);
  const chain = network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);

  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const memoryContract = getContract({
    address: config.addresses.agentMemory,
    abi: agentMemoryAbi,
    client: { public: publicClient },
  });
  const metaContract = getContract({
    address: addrs.agentMetadata,
    abi: agentMetadataAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  const storage = createZgStorageBackend({
    rpcUrl: config.rpcUrl,
    indexerUrl: config.indexerUrl,
    privateKey: config.genomeWriterPrivateKey,
  });

  const { client: inference, mode } = buildInference(logger);
  logger.info("inference backend", { mode, lookback });

  console.log(`\n=== Skill promotion pass for round ${roundId} (${agentIds.length} agents) ===\n`);

  for (const agentId of agentIds) {
    try {
      const totalShards = (await memoryContract.read.shardCountOf([agentId])) as bigint;
      const take = Math.min(lookback, Number(totalShards));
      if (take < 2) {
        console.log(`agent ${agentId}  only ${totalShards} shards, need >= 2 — skipping`);
        continue;
      }

      const shards: Array<{ index: bigint; rootHash: `0x${string}` }> = [];
      for (let i = 0; i < take; i++) {
        const idx = totalShards - 1n - BigInt(i);
        const rootHash = (await memoryContract.read.shardAt([agentId, idx])) as `0x${string}`;
        shards.push({ index: idx, rootHash });
      }

      const shardSummaries: string[] = [];
      for (const { index, rootHash } of shards) {
        try {
          const bytes = await storage.download(rootHash);
          const shard = deserializeShard(bytes);
          shardSummaries.push(
            `[shard ${index}] round=${shard.roundId} prediction=${shard.myPrediction} outcome=${shard.actualOutcome} delta=${shard.scoreDelta} lesson="${shard.lesson}"`
          );
        } catch (err) {
          logger.warn("failed to download shard", {
            agentId: String(agentId),
            rootHash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (shardSummaries.length < 2) {
        console.log(`agent ${agentId}  not enough downloadable shards (${shardSummaries.length}) — skipping`);
        continue;
      }

      const userPrompt = [
        `Agent token #${agentId} has accumulated ${totalShards} memory shards. Most recent ${shardSummaries.length}:`,
        ``,
        ...shardSummaries,
        ``,
        `Decide whether to promote a new earned skill now.`,
      ].join("\n");

      logger.info("asking 0G Compute for promotion decision", {
        agentId: String(agentId),
        shards: shardSummaries.length,
      });

      const response = await inference.complete({
        systemPrompt: SKILL_PROMOTION_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.3,
        maxTokens: 700,
      });

      const promotion = parsePromotion(response.text);
      if (!promotion) {
        console.log(`agent ${agentId}  decided NO promotion`);
        continue;
      }

      const already = (await metaContract.read.hasEarnedSkill([
        agentId,
        promotion.skillName,
      ])) as boolean;
      if (already) {
        console.log(`agent ${agentId}  skill "${promotion.skillName}" already earned — skipping`);
        continue;
      }

      const skillBytes = new TextEncoder().encode(promotion.markdown);
      const upload = await storage.upload(skillBytes);
      logger.info("uploaded skill markdown to 0G Storage", {
        agentId: String(agentId),
        skillName: promotion.skillName,
        rootHash: upload.rootHash,
      });

      const txHash = (await metaContract.write.recordEarnedSkill(
        [agentId, promotion.skillName, upload.rootHash, roundId, promotion.reasoning],
        { account, chain }
      )) as Hex;
      await publicClient
        .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
        .catch(() => undefined);

      console.log(`agent ${agentId}  EARNED  "${promotion.skillName}"`);
      console.log(`  reasoning:   ${promotion.reasoning}`);
      console.log(`  rootHash:    ${upload.rootHash}`);
      console.log(`  tx:          ${txHash}\n`);
    } catch (err) {
      logger.error("skill promotion failed for agent (continuing)", {
        agentId: String(agentId),
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`agent ${agentId}  FAILED — ${err instanceof Error ? err.message.split("\n")[0] : String(err)}\n`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
