import { predictionRoundAbi } from "@progena/sdk";
import type { Address, Hex, PublicClient } from "viem";
import type { Logger } from "../lib/logger.js";
import type { RoundCreatedEvent, RoundCreatedHandler, Unsubscribe } from "./types.js";

export interface RoundWatcherOptions {
  publicClient: PublicClient;
  predictionRoundAddress: Address;
  onCreated: RoundCreatedHandler;
  logger?: Logger;
  fromBlock?: bigint;
  pollingIntervalMs?: number;
}

export function startRoundWatcher(opts: RoundWatcherOptions): Unsubscribe {
  const log = opts.logger?.child({ component: "round-watcher" });

  log?.info("subscribing to RoundCreated", {
    address: opts.predictionRoundAddress,
    fromBlock: opts.fromBlock !== undefined ? String(opts.fromBlock) : "latest",
  });

  return opts.publicClient.watchContractEvent({
    address: opts.predictionRoundAddress,
    abi: predictionRoundAbi,
    eventName: "RoundCreated",
    fromBlock: opts.fromBlock,
    pollingInterval: opts.pollingIntervalMs,
    onLogs: async (logs) => {
      for (const entry of logs) {
        const args = entry.args as Record<string, unknown> | undefined;
        if (!args) continue;
        const event: RoundCreatedEvent = {
          roundId: args.roundId as bigint,
          questionHash: args.questionHash as Hex,
          commitDeadline: args.commitDeadline as bigint,
          revealDeadline: args.revealDeadline as bigint,
          entryFee: args.entryFee as bigint,
          blockNumber: entry.blockNumber ?? 0n,
          txHash: entry.transactionHash ?? "0x",
          logIndex: entry.logIndex ?? 0,
        };

        log?.info("round created event received", {
          roundId: String(event.roundId),
          commitDeadline: String(event.commitDeadline),
          revealDeadline: String(event.revealDeadline),
          txHash: event.txHash,
        });

        try {
          await opts.onCreated(event);
        } catch (err) {
          log?.error("round handler failed", {
            roundId: String(event.roundId),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    },
    onError: (err) => {
      log?.error("watch error", { error: err.message });
    },
  });
}
