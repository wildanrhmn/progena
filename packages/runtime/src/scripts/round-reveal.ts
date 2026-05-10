import { join } from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GenomeStorage, createZgStorageBackend, zgGalileo, zgMainnet } from "@progena/sdk";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { createFileCommitStore } from "../round/commit-store.js";
import { createStubInferenceClient } from "../round/inference.js";
import { createRoundChain } from "../round/round-chain.js";
import { RoundRunner } from "../round/round-runner.js";
import { bigintArg, listArg } from "./args.js";

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const agentIds = listArg("agents");
  const commitStorePath = join(process.cwd(), "state", "commits.json");

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-reveal", network: config.network, roundId: String(roundId) },
  });

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

  const inference = createStubInferenceClient();
  const commitStore = createFileCommitStore(commitStorePath);
  const runner = new RoundRunner({ chain, storage, inference, commitStore, logger });

  logger.info("revealing for agents", { agents: agentIds.map((a) => String(a)) });

  const results = await runner.revealForAgents(roundId, agentIds);

  console.log(`\n=== Reveals for round ${roundId} ===`);
  for (const r of results) {
    console.log(`\nagent ${r.agentId}`);
    console.log(`  prediction:    ${r.prediction}`);
    console.log(`  revealTx:      ${r.revealTxHash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
