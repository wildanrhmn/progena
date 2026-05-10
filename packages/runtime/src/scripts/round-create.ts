import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  keccak256,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { predictionRoundAbi, zgGalileo, zgMainnet } from "@progena/sdk";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { arg, intArg, requiredArg } from "./args.js";
import { recordRound } from "./round-store.js";

async function main(): Promise<void> {
  const question = requiredArg("question");
  const commitMins = intArg("commit-mins", 60);
  const revealMins = intArg("reveal-mins", 60);
  const entryFeeWei = arg("entry-fee-wei") ? BigInt(arg("entry-fee-wei")!) : 0n;
  const storePath = join(process.cwd(), "state", "rounds.json");

  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "round-create", network: config.network },
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

  const now = Math.floor(Date.now() / 1000);
  const commitDeadline = BigInt(now + commitMins * 60);
  const revealDeadline = BigInt(now + (commitMins + revealMins) * 60);
  const questionHash = keccak256(toBytes(question));

  logger.info("creating round", {
    question,
    commitDeadline: Number(commitDeadline),
    revealDeadline: Number(revealDeadline),
    entryFeeWei: String(entryFeeWei),
  });

  const txHash = (await round.write.createRound(
    [questionHash, commitDeadline, revealDeadline, entryFeeWei],
    { account, chain }
  )) as Hex;
  await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000, retryCount: 30 });

  const nextRoundId = await round.read.nextRoundId();
  const newRoundId = nextRoundId - 1n;

  await recordRound(storePath, {
    roundId: String(newRoundId),
    question,
    questionHash,
    commitDeadline: Number(commitDeadline),
    revealDeadline: Number(revealDeadline),
    txHash,
    createdAt: now,
  });

  logger.info("round created", {
    roundId: String(newRoundId),
    txHash,
  });

  console.log(`\n=== Round ${newRoundId} created ===`);
  console.log(`question:        ${question}`);
  console.log(`questionHash:    ${questionHash}`);
  console.log(`commitDeadline:  ${new Date(Number(commitDeadline) * 1000).toISOString()}`);
  console.log(`revealDeadline:  ${new Date(Number(revealDeadline) * 1000).toISOString()}`);
  console.log(`tx:              ${txHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
