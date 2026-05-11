import { join } from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GenomeStorage, zgGalileo, zgMainnet } from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { createFileCommitStore } from "../round/commit-store.js";
import { execSync } from "node:child_process";
import {
  createOpenClawInferenceClient,
  createStubInferenceClient,
  createZGComputeInferenceClient,
  type InferenceClient,
} from "../round/inference.js";
import { createRoundChain } from "../round/round-chain.js";
import { RoundRunner } from "../round/round-runner.js";
import { buildDefaultToolRegistry } from "../tools/index.js";
import { createAgenticInferenceClient } from "../round/agentic-inference.js";
import {
  connectBroker,
  ensureLedger,
  ensureProviderFunded,
  listChatServices,
  pickChatService,
} from "../compute/index.js";
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

async function buildInferenceClient(
  config: ReturnType<typeof loadConfig>,
  logger: Logger
): Promise<{ client: InferenceClient; mode: string }> {
  if (process.env.INFERENCE_MODE !== "compute" && openclawAvailable()) {
    logger.info("using OpenClaw orchestration (routes inference through the local proxy → 0G Compute)");
    return {
      client: createOpenClawInferenceClient({ logger }),
      mode: "OpenClaw → 0G Compute (via proxy)",
    };
  }

  try {
    const ctx = await connectBroker({
      rpcUrl: config.rpcUrl,
      privateKey: config.genomeWriterPrivateKey,
      logger,
    });
    await ensureLedger(ctx, config.zgComputeLedgerOg, logger);

    let providerAddress = config.zgComputeProvider as string | undefined;
    if (!providerAddress) {
      const services = await listChatServices(ctx);
      const picked = pickChatService(services);
      if (!picked) throw new Error("no chat provider available on 0G Compute");
      providerAddress = picked.provider;
    }
    await ensureProviderFunded(ctx, providerAddress, config.zgComputeProviderFundOg, logger);
    return {
      client: createZGComputeInferenceClient({ ctx, providerAddress, logger }),
      mode: `0G Compute direct · provider ${providerAddress}`,
    };
  } catch (err) {
    logger.warn("inference setup failed, falling back to stub", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { client: createStubInferenceClient(), mode: "stub (no inference backend)" };
  }
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

  const { client: inference, mode: inferenceMode } = await buildInferenceClient(
    config,
    logger
  );

  const tavilyApiKey = process.env.TAVILY_API_KEY ?? "";
  const registry = buildDefaultToolRegistry({
    publicClient,
    addresses: {
      agentGenome: config.addresses.agentGenome,
      agentMemory: config.addresses.agentMemory,
      reputationOracle: config.addresses.reputationOracle,
      predictionRound: config.addresses.predictionRound,
      agentMetadata:
        (config.addresses as { agentMetadata?: `0x${string}` }).agentMetadata ??
        ("0x0000000000000000000000000000000000000000" as `0x${string}`),
    },
    tavilyApiKey,
  });
  const proxyBaseUrl = process.env.OPENAI_PROXY_URL ?? "http://127.0.0.1:8787/v1";
  const proxyModel = process.env.OPENAI_PROXY_MODEL ?? "deepseek/deepseek-chat-v3-0324";
  const agenticInference = createAgenticInferenceClient({
    baseUrl: proxyBaseUrl,
    model: proxyModel,
    registry,
    logger,
  });

  const commitStore = createFileCommitStore(commitStorePath);
  const runner = new RoundRunner({
    chain,
    storage,
    inference,
    agenticInference,
    commitStore,
    logger,
  });

  logger.info("committing for agents", {
    agents: agentIds.map((a) => String(a)),
    inferenceMode,
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
