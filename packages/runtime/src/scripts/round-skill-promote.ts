import { join } from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zgGalileo, zgMainnet } from "@progena/sdk";
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
import { promoteSkills } from "../round/promote-skills.js";

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
  return { agentMetadata: parsed.contracts.AgentMetadata as Address };
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

  const storage = createZgStorageBackend({
    rpcUrl: config.rpcUrl,
    indexerUrl: config.indexerUrl,
    privateKey: config.genomeWriterPrivateKey,
  });

  const { client: inference, mode } = buildInference(logger);
  logger.info("inference backend", { mode, lookback });

  console.log(`\n=== Skill promotion pass for round ${roundId} (${agentIds.length} agents) ===\n`);

  const result = await promoteSkills(
    { agentIds, earnedInRound: roundId, lookback },
    {
      publicClient,
      walletClient,
      account,
      chain,
      storage,
      inference,
      agentMemoryAddress: config.addresses.agentMemory,
      agentMetadataAddress: addrs.agentMetadata,
      logger,
    }
  );

  for (const p of result.promoted) {
    console.log(`agent ${p.agentId}  EARNED  "${p.skillName}"`);
    console.log(`  reasoning:   ${p.reasoning}`);
    console.log(`  rootHash:    ${p.rootHash}`);
    console.log(`  tx:          ${p.txHash}\n`);
  }
  for (const d of result.declined) {
    console.log(`agent ${d.agentId}  declined: ${d.reason}`);
  }
  for (const f of result.failed) {
    console.log(`agent ${f.agentId}  FAILED — ${f.error}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
