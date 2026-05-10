import { join } from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  GenomeStorage,
  createZgStorageBackend,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { createFileCommitStore } from "../round/commit-store.js";
import {
  createOpenAIInferenceClient,
  createStubInferenceClient,
  type InferenceClient,
} from "../round/inference.js";
import { createRoundChain } from "../round/round-chain.js";
import { RoundRunner } from "../round/round-runner.js";
import { bigintArg, listArg } from "./args.js";
import { getRound } from "./round-store.js";

async function buildInferenceClient(config: ReturnType<typeof loadConfig>): Promise<InferenceClient> {
  if (!config.zgComputeBaseUrl || !config.zgComputeToken) {
    return createStubInferenceClient();
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: config.zgComputeBaseUrl,
    apiKey: config.zgComputeToken,
  });
  return createOpenAIInferenceClient({ client });
}

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const agentIds = listArg("agents");
  const storePath = join(process.cwd(), "state", "rounds.json");
  const commitStorePath = join(process.cwd(), "state", "commits.json");

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-commit", network: config.network, roundId: String(roundId) },
  });

  const round = await getRound(storePath, roundId);
  if (!round) {
    throw new Error(`round ${roundId} not found in ${storePath} — create it first`);
  }

  const chainNet = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain: chainNet, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: chainNet, transport: http(config.rpcUrl) });

  const storage = new GenomeStorage(
    createZgStorageBackend({
      rpcUrl: config.rpcUrl,
      indexerUrl: config.indexerUrl,
      privateKey: config.genomeWriterPrivateKey,
    })
  );

  const chain = createRoundChain({
    agentGenomeAddress: config.addresses.agentGenome,
    predictionRoundAddress: config.addresses.predictionRound,
    publicClient,
    walletClient,
  });

  const inference = await buildInferenceClient(config);
  const commitStore = createFileCommitStore(commitStorePath);
  const runner = new RoundRunner({ chain, storage, inference, commitStore, logger });

  logger.info("committing for agents", {
    agents: agentIds.map((a) => String(a)),
    inferenceMode: config.zgComputeBaseUrl ? "0G Compute" : "stub",
  });

  const results = await runner.commitForAgents(roundId, agentIds, round.question);

  console.log(`\n=== Commits for round ${roundId} ===`);
  for (const r of results) {
    console.log(`\nagent ${r.agentId}`);
    console.log(`  prediction:   ${r.prediction}`);
    console.log(`  commitHash:   ${r.commitHash}`);
    console.log(`  commitTx:     ${r.commitTxHash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
