import { createRequire } from "node:module";
import { ethers } from "ethers";
import type { Logger } from "../lib/logger.js";

// The 0G Compute SDK ships a broken ESM bundle (rolled-up chunked re-exports
// fail to resolve in Node's strict ESM loader), so we load the CJS build
// explicitly. This is robust across SDK versions.
const requireCjs = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = requireCjs(
  "@0gfoundation/0g-compute-ts-sdk"
) as typeof import("@0gfoundation/0g-compute-ts-sdk");

export interface BrokerOptions {
  rpcUrl: string;
  privateKey: string;
  logger?: Logger;
}

export type ZGBroker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;

export interface BrokerContext {
  broker: ZGBroker;
  wallet: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  address: string;
}

export async function connectBroker(opts: BrokerOptions): Promise<BrokerContext> {
  const provider = new ethers.JsonRpcProvider(opts.rpcUrl);
  const wallet = new ethers.Wallet(opts.privateKey, provider);
  opts.logger?.info?.("connecting to 0G compute broker", {
    rpcUrl: opts.rpcUrl,
    operator: wallet.address,
  });
  const broker = await createZGComputeNetworkBroker(wallet as never);
  return { broker, wallet, provider, address: wallet.address };
}

/**
 * Ensures the operator wallet has a broker ledger funded with at least
 * `minimumOg`. Idempotent — adds the ledger if missing, tops it up
 * otherwise. Returns whether a tx was sent.
 */
export async function ensureLedger(
  ctx: BrokerContext,
  minimumOg: number,
  logger?: Logger
): Promise<{ created: boolean; toppedUp: boolean }> {
  let existing: { totalBalance?: bigint } | null = null;
  try {
    existing = (await ctx.broker.ledger.getLedger()) as any;
  } catch {
    existing = null;
  }

  if (!existing) {
    logger?.info?.("creating compute ledger", { amountOg: minimumOg });
    await ctx.broker.ledger.addLedger(minimumOg);
    return { created: true, toppedUp: false };
  }

  const min = ethers.parseEther(minimumOg.toString());
  const balance =
    typeof existing.totalBalance === "bigint" ? existing.totalBalance : 0n;
  if (balance < min) {
    const needed = min - balance;
    const ogAmount = Number(ethers.formatEther(needed));
    logger?.info?.("topping up compute ledger", { addOg: ogAmount });
    await ctx.broker.ledger.depositFund(ogAmount);
    return { created: false, toppedUp: true };
  }
  logger?.debug?.("compute ledger already funded", {
    balanceOg: Number(ethers.formatEther(balance)),
  });
  return { created: false, toppedUp: false };
}

/**
 * Acknowledges and funds a specific provider's inference sub-account.
 * Both calls are idempotent at the protocol level; we swallow expected
 * "already done" errors.
 */
export async function ensureProviderFunded(
  ctx: BrokerContext,
  providerAddress: string,
  amountOg: number,
  logger?: Logger
): Promise<void> {
  try {
    await ctx.broker.inference.acknowledgeProviderSigner(providerAddress);
    logger?.debug?.("acknowledged provider signer", { provider: providerAddress });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already/i.test(msg)) {
      logger?.warn?.("acknowledgeProviderSigner failed (continuing)", {
        provider: providerAddress,
        error: msg,
      });
    }
  }

  try {
    const wei = ethers.parseEther(amountOg.toString());
    await ctx.broker.ledger.transferFund(providerAddress, "inference", wei);
    logger?.info?.("funded provider sub-account", {
      provider: providerAddress,
      amountOg,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already|exists/i.test(msg)) {
      logger?.warn?.("transferFund failed (continuing)", {
        provider: providerAddress,
        error: msg,
      });
    }
  }
}
