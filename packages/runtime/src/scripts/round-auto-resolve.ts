import { join } from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zgGalileo, zgMainnet } from "@progena/sdk";
import { loadConfig } from "./../config.js";
import { createLogger } from "./../lib/logger.js";
import { bigintArg } from "./args.js";
import { getRound } from "./round-store.js";
import { buildResolveContext, resolveRound } from "../round/resolve-round.js";

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const storePath = join(process.cwd(), "state", "rounds.json");

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-auto-resolve", network: config.network, roundId: String(roundId) },
  });

  const round = await getRound(storePath, roundId);
  if (!round) throw new Error(`round ${roundId} not found in ${storePath}`);

  const tavilyApiKey = process.env.TAVILY_API_KEY ?? "";
  if (!tavilyApiKey) {
    throw new Error("TAVILY_API_KEY env var is required for the research oracle. Set it in runtime/.env");
  }

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const ctx = buildResolveContext({
    publicClient,
    walletClient,
    account,
    chain,
    rpcUrl: config.rpcUrl,
    predictionRoundAddress: config.addresses.predictionRound,
    agentGenomeAddress: config.addresses.agentGenome,
    agentMemoryAddress: config.addresses.agentMemory,
    reputationOracleAddress: config.addresses.reputationOracle,
    agentMetadataAddress: (config.addresses as { agentMetadata?: `0x${string}` }).agentMetadata,
    tavilyApiKey,
    logger,
  });

  const result = await resolveRound(
    { roundId, question: round.question, questionHash: round.questionHash },
    ctx
  );

  console.log("\n=== Oracle research trace ===");
  for (const c of result.toolCalls) {
    console.log(`[${c.ok ? "ok" : "ERR"}] ${c.tool}(${JSON.stringify(c.args).slice(0, 100)}) in ${c.durationMs}ms`);
    console.log(`   ${c.summary.slice(0, 240).replace(/\n/g, " ")}`);
  }
  console.log("\n=== Final answer ===");
  console.log(result.finalText.slice(-400));
  console.log(`\nparsed outcome (bps): ${result.outcome}`);
  console.log(`tx: ${result.txHash}`);
  console.log(`attestation: ${ctx.attestationPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
