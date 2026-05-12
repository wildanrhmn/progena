import { join } from "node:path";
import {
  getContract,
  type Hex,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { predictionRoundAbi } from "@progena/sdk";
import type { Logger } from "../lib/logger.js";
import {
  appendOracleAttestation,
  type OracleAttestation,
} from "./oracle-attestation.js";
import {
  createAgenticInferenceClient,
  type AgenticInferenceClient,
} from "./agentic-inference.js";
import { parseOracleOutcome } from "./oracle-parser.js";
import { buildDefaultToolRegistry } from "../tools/index.js";
import type { ToolRegistry } from "../tools/index.js";

export function buildOracleSystemPrompt(now: Date): string {
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

export interface ResolveRoundContext {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  chain: Chain;
  inference: AgenticInferenceClient;
  predictionRoundAddress: `0x${string}`;
  attestationPath?: string;
  logger?: Logger;
}

export interface ResolveRoundInput {
  roundId: bigint;
  question: string;
  questionHash: `0x${string}`;
}

export interface ResolveRoundResult {
  outcome: number;
  finalText: string;
  iterations: number;
  toolCalls: OracleAttestation["toolCalls"];
  txHash: Hex;
  attestation: OracleAttestation;
}

export async function resolveRound(
  input: ResolveRoundInput,
  ctx: ResolveRoundContext
): Promise<ResolveRoundResult> {
  const { roundId, question, questionHash } = input;
  const log = ctx.logger?.child?.({ component: "resolve-round", roundId: String(roundId) });

  log?.info?.("running oracle inference with web_search");
  const userPrompt = [
    `Round: #${roundId}`,
    `Question: ${question}`,
    ``,
    `Research the question, then output FINAL_ANSWER: <int>.`,
  ].join("\n");

  const result = await ctx.inference.run({
    systemPrompt: buildOracleSystemPrompt(new Date()),
    userPrompt,
    toolNames: ["web_search"],
    temperature: 0.2,
    maxTokens: 1200,
    maxIterations: 6,
    context: { logger: log, roundId },
  });

  const outcome = parseOracleOutcome(result.finalText);

  const attestation: OracleAttestation = {
    version: 1,
    roundId: roundId.toString(),
    question,
    questionHash,
    outcomeBps: outcome,
    finalAnswer: result.finalText,
    model: result.model,
    iterations: result.iterations,
    toolCalls: result.toolCalls,
    resolvedAt: Math.floor(Date.now() / 1000),
  };
  if (ctx.attestationPath) {
    await appendOracleAttestation(ctx.attestationPath, attestation);
  }

  const predictionRound = getContract({
    address: ctx.predictionRoundAddress,
    abi: predictionRoundAbi,
    client: { public: ctx.publicClient, wallet: ctx.walletClient },
  });

  log?.info?.("submitting resolveRound", { outcome });
  const txHash = (await predictionRound.write.resolveRound([roundId, outcome], {
    account: ctx.account,
    chain: ctx.chain,
  })) as Hex;

  await ctx.publicClient
    .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
    .catch(() => undefined);

  return {
    outcome,
    finalText: result.finalText,
    iterations: result.iterations,
    toolCalls: result.toolCalls,
    txHash,
    attestation,
  };
}

export interface BuildResolveContextInput {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  chain: Chain;
  rpcUrl: string;
  predictionRoundAddress: `0x${string}`;
  agentGenomeAddress: `0x${string}`;
  agentMemoryAddress: `0x${string}`;
  reputationOracleAddress: `0x${string}`;
  agentMetadataAddress?: `0x${string}`;
  tavilyApiKey: string;
  proxyBaseUrl?: string;
  proxyModel?: string;
  attestationPath?: string;
  logger?: Logger;
}

export interface BuiltResolveContext extends ResolveRoundContext {
  registry: ToolRegistry;
}

export function buildResolveContext(input: BuildResolveContextInput): BuiltResolveContext {
  const registry = buildDefaultToolRegistry({
    publicClient: input.publicClient,
    addresses: {
      agentGenome: input.agentGenomeAddress,
      agentMemory: input.agentMemoryAddress,
      reputationOracle: input.reputationOracleAddress,
      predictionRound: input.predictionRoundAddress,
      agentMetadata:
        input.agentMetadataAddress ??
        ("0x0000000000000000000000000000000000000000" as `0x${string}`),
    },
    tavilyApiKey: input.tavilyApiKey,
  });

  const inference = createAgenticInferenceClient({
    baseUrl: input.proxyBaseUrl ?? "http://127.0.0.1:8787/v1",
    model: input.proxyModel ?? "deepseek/deepseek-chat-v3-0324",
    registry,
    logger: input.logger,
  });

  return {
    publicClient: input.publicClient,
    walletClient: input.walletClient,
    account: input.account,
    chain: input.chain,
    inference,
    predictionRoundAddress: input.predictionRoundAddress,
    attestationPath:
      input.attestationPath ?? join(process.cwd(), "state", "oracle-attestations.json"),
    logger: input.logger,
    registry,
  };
}
