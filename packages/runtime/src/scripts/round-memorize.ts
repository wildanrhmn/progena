import { join } from "node:path";
import { execSync } from "node:child_process";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zgGalileo, zgMainnet } from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { createFileCommitStore } from "../round/commit-store.js";
import {
  createOpenClawInferenceClient,
  createStubInferenceClient,
  type InferenceClient,
} from "../round/inference.js";
import { memorizeRound, shardCountOf } from "../round/memorize-round.js";
import type { Logger } from "../lib/logger.js";
import { bigintArg, listArg } from "./args.js";
import { getRound } from "./round-store.js";

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

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const agentIds = listArg("agents");
  const storePath = join(process.cwd(), "state", "rounds.json");
  const commitStorePath = join(process.cwd(), "state", "commits.json");
  const commitStore = createFileCommitStore(commitStorePath);

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-memorize", network: config.network, roundId: String(roundId) },
  });

  const round = await getRound(storePath, roundId);
  if (!round) throw new Error(`round ${roundId} not found in ${storePath}`);

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const storage = createZgStorageBackend({
    rpcUrl: config.rpcUrl,
    indexerUrl: config.indexerUrl,
    privateKey: config.genomeWriterPrivateKey,
  });
  const { client: inference, mode } = buildInference(logger);
  logger.info("inference backend", { mode });

  console.log(`\n=== Memorizing round ${roundId} for ${agentIds.length} agents ===\n`);

  const result = await memorizeRound(
    { roundId, question: round.question, questionHash: round.questionHash, agentIds },
    {
      publicClient,
      walletClient,
      account,
      chain,
      storage,
      inference,
      commitStore,
      predictionRoundAddress: config.addresses.predictionRound,
      agentMemoryAddress: config.addresses.agentMemory,
      logger,
    }
  );

  for (const s of result.shards) {
    const after = await shardCountOf(publicClient, config.addresses.agentMemory, s.agentId);
    console.log(`agent ${s.agentId}`);
    console.log(`  prediction:    ${s.prediction}`);
    console.log(`  outcome:       ${s.outcome}`);
    console.log(`  scoreDelta:    ${s.scoreDelta}`);
    console.log(`  lesson:        ${s.lesson.slice(0, 160)}${s.lesson.length > 160 ? "…" : ""}`);
    console.log(`  shardRootHash: ${s.rootHash}`);
    console.log(`  addShard tx:   ${s.txHash}`);
    console.log(`  shardCount:    → ${after}\n`);
  }
  for (const s of result.skipped) {
    console.log(`agent ${s.agentId}  SKIPPED — ${s.reason}\n`);
  }
  for (const f of result.failed) {
    console.log(`agent ${f.agentId}  FAILED — ${f.error}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
