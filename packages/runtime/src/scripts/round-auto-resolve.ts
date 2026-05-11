import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { predictionRoundAbi, zgGalileo, zgMainnet } from "@progena/sdk";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import {
  createOpenClawInferenceClient,
  type InferenceClient,
} from "../round/inference.js";
import type { Logger } from "../lib/logger.js";
import { bigintArg } from "./args.js";
import { getRound } from "./round-store.js";

function openclawAvailable(bin = "openclaw"): boolean {
  try {
    execSync(`${bin} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function clampOutcome(n: number): number {
  if (!Number.isFinite(n)) return 5000;
  return Math.max(0, Math.min(10_000, Math.round(n)));
}

function parseOutcome(text: string): number {
  const cleaned = text.replace(/[*_`]/g, "");
  const matches = cleaned.match(/-?\d{1,5}(?:\.\d+)?/g) ?? [];
  if (matches.length === 0) return 5000;
  for (const m of matches.reverse()) {
    const n = Number(m);
    if (Number.isFinite(n) && n >= 0 && n <= 10_000) return clampOutcome(n);
  }
  return clampOutcome(Number(matches[0]));
}

async function deriveOutcome(
  question: string,
  inference: InferenceClient,
  logger: Logger
): Promise<{ outcome: number; rawAnswer: string }> {
  const systemPrompt =
    "You are an on-chain oracle resolving a prediction market round. Be decisive and concise. Output ONLY a single integer in [0, 10000] representing the truth value of the question in basis points (10000 = 100%, 5000 = 50%, 0 = 0%). No explanation, no units, no words — just the integer.";
  const userPrompt = `Question: ${question}\n\nAnswer (single integer 0-10000):`;
  logger.info("asking oracle agent for truth value");
  const r = await inference.complete({ systemPrompt, userPrompt, temperature: 0.1, maxTokens: 32 });
  const outcome = parseOutcome(r.text);
  return { outcome, rawAnswer: r.text };
}

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const storePath = join(process.cwd(), "state", "rounds.json");

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-auto-resolve", network: config.network, roundId: String(roundId) },
  });

  const round = await getRound(storePath, roundId);
  if (!round) {
    throw new Error(`round ${roundId} not found in ${storePath}`);
  }

  if (!openclawAvailable()) {
    throw new Error("openclaw CLI not available — install it or configure the proxy first");
  }

  const inference = createOpenClawInferenceClient({ logger });
  const { outcome, rawAnswer } = await deriveOutcome(round.question, inference, logger);
  console.log("oracle raw answer:", rawAnswer.trim().slice(0, 200));
  console.log("parsed outcome (bps):", outcome);

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const predictionRound = getContract({
    address: config.addresses.predictionRound,
    abi: predictionRoundAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  logger.info("submitting resolveRound", { outcome });
  const txHash = (await predictionRound.write.resolveRound([roundId, outcome], {
    account,
    chain,
  })) as Hex;

  await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 180_000,
    retryCount: 60,
  });

  console.log(`\n=== Round ${roundId} auto-resolved ===`);
  console.log(`oracle:            OpenClaw → 0G Compute (DeepSeek v3)`);
  console.log(`outcome (bps):     ${outcome}`);
  console.log(`tx:                ${txHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
