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
import { bigintArg, intArg } from "./args.js";

async function main(): Promise<void> {
  const roundId = bigintArg("round");
  const outcome = intArg("outcome");

  if (outcome < 0 || outcome > 10_000) {
    throw new Error("--outcome must be in [0, 10000]");
  }

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-resolve", network: config.network, roundId: String(roundId) },
  });

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const round = getContract({
    address: config.addresses.predictionRound,
    abi: predictionRoundAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  logger.info("resolving round", { outcome });
  const txHash = (await round.write.resolveRound([roundId, outcome], {
    account,
    chain,
  })) as Hex;
  await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 120_000,
    retryCount: 30,
  });

  const data = await round.read.roundOf([roundId]);
  console.log(`\n=== Round ${roundId} resolved ===`);
  console.log(`outcome (bps):     ${outcome}`);
  console.log(`scoredAgents:      ${data.totalRevealed}`);
  console.log(`tx:                ${txHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
