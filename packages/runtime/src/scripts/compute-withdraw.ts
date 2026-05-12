import { ethers } from "ethers";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { connectBroker } from "../compute/broker.js";

async function main(): Promise<void> {
  const amountOgArg = process.argv[2];
  const requested = amountOgArg ? Number(amountOgArg) : 4;
  if (!Number.isFinite(requested) || requested <= 0) {
    console.error("usage: tsx compute-withdraw.ts <amountOg>");
    process.exit(2);
  }

  const config = loadConfig();
  const logger = createLogger({
    level: "info",
    bindings: { service: "compute-withdraw" },
  });

  const ctx = await connectBroker({
    privateKey: config.genomeWriterPrivateKey,
    rpcUrl: config.rpcUrl,
    logger,
  });

  const before = await ethers.JsonRpcProvider.prototype.getBalance.call(
    ctx.provider,
    ctx.address
  );
  console.log("\nbefore");
  console.log(`  wallet (${ctx.address}): ${ethers.formatEther(before)} OG`);
  const ledgerBefore = (await ctx.broker.ledger.getLedger()) as any;
  const ledgerBefBal = ledgerBefore?.totalBalance
    ? BigInt(ledgerBefore.totalBalance.toString())
    : 0n;
  console.log(`  broker ledger:            ${ethers.formatEther(ledgerBefBal)} OG`);

  const provider = config.zgComputeProvider;
  if (provider) {
    try {
      console.log("\nsettling provider sub-account back to ledger…");
      await (ctx.broker.ledger as any).retrieveFund?.([provider], "inference");
      console.log("  settled");
    } catch (err) {
      console.log("  skip (retrieveFund failed or no funds to settle):", err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nwithdrawing ${requested} OG from ledger to wallet…`);

  let succeeded = false;
  const ledgerAny = ctx.broker.ledger as any;
  const tryWithGas = async (label: string, gwei: number) => {
    if (succeeded) return;
    try {
      const gasPriceWei = BigInt(gwei) * 1_000_000_000n;
      console.log(`  trying refund(${requested}) @ ${gwei} gwei…`);
      ledgerAny.gasPrice = gasPriceWei;
      ledgerAny.maxGasPrice = gasPriceWei * 2n;
      await ledgerAny.refund(requested);
      console.log(`  ${label} succeeded`);
      succeeded = true;
    } catch (err) {
      console.log(`  ${label} failed:`, err instanceof Error ? err.message : err);
    }
  };

  for (const gwei of [1, 2, 3, 4]) {
    await tryWithGas(`refund @ ${gwei} gwei`, gwei);
  }

  if (!succeeded) {
    console.log("\n!! no withdraw method worked. SDK shape may have changed.");
    console.log("   available ledger methods:");
    for (const key of Object.keys(ledgerAny)) {
      console.log(`   - ${key}`);
    }
    process.exit(1);
  }

  console.log("\nafter");
  const after = await ctx.provider.getBalance(ctx.address);
  console.log(`  wallet (${ctx.address}): ${ethers.formatEther(after)} OG`);
  const ledgerAfter = (await ctx.broker.ledger.getLedger()) as any;
  const ledgerAftBal = ledgerAfter?.totalBalance
    ? BigInt(ledgerAfter.totalBalance.toString())
    : 0n;
  console.log(`  broker ledger:            ${ethers.formatEther(ledgerAftBal)} OG`);
  console.log(`\nrecovered: ${ethers.formatEther(after - before)} OG`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
