import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { predictionRoundAbi, zgGalileo, zgMainnet } from "@progena/sdk";
import { loadConfig } from "./../config.js";
import { createLogger } from "./../lib/logger.js";
import { bigintArg } from "./args.js";
import { getRound } from "./round-store.js";
import { buildDefaultToolRegistry } from "../tools/index.js";
import { createAgenticInferenceClient } from "../round/agentic-inference.js";
import {
  appendOracleAttestation,
  type OracleAttestation,
} from "../round/oracle-attestation.js";

const PROXY_BASE_URL = process.env.OPENAI_PROXY_URL ?? "http://127.0.0.1:8787/v1";
const PROXY_MODEL = process.env.OPENAI_PROXY_MODEL ?? "deepseek/deepseek-chat-v3-0324";

import { parseOracleOutcome } from "../round/oracle-parser.js";

function buildOracleSystemPrompt(now: Date): string {
  const iso = now.toISOString().slice(0, 10);
  const human = now.toUTCString().replace(/^[A-Z][a-z]{2}, /, "");
  return [
    `You are the on-chain oracle resolving a Progena prediction-market round on 0G Chain.`,
    ``,
    `THE CURRENT REAL-WORLD DATE IS ${iso} (${human}). Do NOT default to your training-cutoff date when interpreting "today", "now", "current", or "recent" in the question. Anchor all reasoning and search queries to ${iso}.`,
    ``,
    `Your job: derive the truth value of the question as an integer in [0, 10000] basis points, where 0 = certainly NO, 10000 = certainly YES, 5000 = uncertain.`,
    ``,
    `Available tool: web_search — use it 2 to 4 times to gather real evidence about the question. Search for:`,
    `  1. The most direct phrasing of the question's subject`,
    `  2. Current state or recent news related to the resolution criterion — when crafting queries, include "${iso}" or the current month/year so Tavily returns recent results, NOT historical results from your training era`,
    `  3. Authoritative sources if the question references specific data (prices, counts, dates)`,
    ``,
    `After gathering evidence, REASON briefly about what the evidence shows, then output your final answer on the LAST line in this exact format:`,
    `FINAL_ANSWER: <integer 0-10000>`,
    ``,
    `Calibrate carefully. Don't anchor on round numbers; small movements off 5000 should reflect real evidence asymmetry. If evidence is weak or contradictory, stay near 5000.`,
  ].join("\n");
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

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const tavilyApiKey = process.env.TAVILY_API_KEY ?? "";
  if (!tavilyApiKey) {
    throw new Error(
      "TAVILY_API_KEY env var is required for the research oracle. Set it in runtime/.env"
    );
  }

  const registry = buildDefaultToolRegistry({
    publicClient,
    addresses: {
      agentGenome: config.addresses.agentGenome,
      agentMemory: config.addresses.agentMemory,
      reputationOracle: config.addresses.reputationOracle,
      predictionRound: config.addresses.predictionRound,
      agentMetadata: (config.addresses as { agentMetadata?: `0x${string}` }).agentMetadata
        ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`),
    },
    tavilyApiKey,
  });

  const inference = createAgenticInferenceClient({
    baseUrl: PROXY_BASE_URL,
    model: PROXY_MODEL,
    registry,
    logger,
  });

  logger.info("running oracle inference with web_search");
  const userPrompt = [
    `Round: #${roundId}`,
    `Question: ${round.question}`,
    ``,
    `Research the question, then output FINAL_ANSWER: <int>.`,
  ].join("\n");

  const result = await inference.run({
    systemPrompt: buildOracleSystemPrompt(new Date()),
    userPrompt,
    toolNames: ["web_search"],
    temperature: 0.2,
    maxTokens: 1200,
    maxIterations: 6,
    context: { logger, roundId },
  });

  const outcome = parseOracleOutcome(result.finalText);

  console.log("\n=== Oracle research trace ===");
  for (const c of result.toolCalls) {
    console.log(`[${c.ok ? "ok" : "ERR"}] ${c.tool}(${JSON.stringify(c.args).slice(0, 100)}) in ${c.durationMs}ms`);
    console.log(`   ${c.summary.slice(0, 240).replace(/\n/g, " ")}`);
  }
  console.log("\n=== Final answer ===");
  console.log(result.finalText.slice(-400));
  console.log("\nparsed outcome (bps):", outcome);

  const attestation: OracleAttestation = {
    version: 1,
    roundId: roundId.toString(),
    question: round.question,
    questionHash: round.questionHash,
    outcomeBps: outcome,
    finalAnswer: result.finalText,
    model: result.model,
    iterations: result.iterations,
    toolCalls: result.toolCalls,
    resolvedAt: Math.floor(Date.now() / 1000),
  };
  const attestationPath = join(process.cwd(), "state", "oracle-attestations.json");
  await appendOracleAttestation(attestationPath, attestation);

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

  await publicClient
    .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
    .catch(() => undefined);

  console.log(`\n=== Round ${roundId} auto-resolved ===`);
  console.log(`oracle:            OpenClaw → 0G Compute (${PROXY_MODEL}) + Tavily web search`);
  console.log(`outcome (bps):     ${outcome}`);
  console.log(`tool calls:        ${result.toolCalls.length}`);
  console.log(`tx:                ${txHash}`);
  console.log(`attestation:       state/oracle-attestations.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
