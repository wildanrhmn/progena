import { ethers } from "ethers";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { connectBroker } from "../compute/broker.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    level: "info",
    bindings: { service: "compute-balance" },
  });

  const ctx = await connectBroker({
    privateKey: config.genomeWriterPrivateKey,
    rpcUrl: config.rpcUrl,
    logger,
  });

  console.log("\n=== compute broker balance ===");

  let ledger: any = null;
  try {
    ledger = await ctx.broker.ledger.getLedger();
  } catch (err) {
    console.log("no ledger or read failed:", err instanceof Error ? err.message : err);
    return;
  }

  const total = ledger?.totalBalance ? BigInt(ledger.totalBalance.toString()) : 0n;
  const locked = ledger?.locked ? BigInt(ledger.locked.toString()) : 0n;
  const available = ledger?.availableBalance
    ? BigInt(ledger.availableBalance.toString())
    : total - locked;

  console.log(`depositor:    ${ctx.address}`);
  console.log(`total:        ${ethers.formatEther(total)} OG`);
  console.log(`locked:       ${ethers.formatEther(locked)} OG`);
  console.log(`available:    ${ethers.formatEther(available)} OG`);

  const provider = config.zgComputeProvider;
  if (provider) {
    try {
      const sub = await (ctx.broker.ledger as any).getAccount?.(provider);
      if (sub) {
        const balRaw = sub.balance ?? sub.totalBalance;
        const sbal = balRaw ? BigInt(balRaw.toString()) : 0n;
        console.log(`provider sub-account (${provider}): ${ethers.formatEther(sbal)} OG`);
      }
    } catch {
      /* ignore */
    }
  }

  console.log("");
  console.log("safe to withdraw (keeps 1 OG buffer for the daemon):");
  const buffer = ethers.parseEther("1");
  const safe = available > buffer ? available - buffer : 0n;
  console.log(`  ${ethers.formatEther(safe)} OG`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
