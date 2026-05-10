import { breedingContractAbi } from "@progena/sdk";
import type { Address, PublicClient } from "viem";
import type { Logger } from "../lib/logger.js";
import type { BreedingEvent, BreedingHandler, Unsubscribe } from "./types.js";

export interface BreedingWatcherOptions {
  publicClient: PublicClient;
  breedingContractAddress: Address;
  onEvent: BreedingHandler;
  logger?: Logger;
  fromBlock?: bigint;
  pollingIntervalMs?: number;
}

export function startBreedingWatcher(opts: BreedingWatcherOptions): Unsubscribe {
  const log = opts.logger?.child({ component: "breeding-watcher" });

  log?.info("subscribing", {
    address: opts.breedingContractAddress,
    fromBlock: opts.fromBlock !== undefined ? String(opts.fromBlock) : "latest",
  });

  return opts.publicClient.watchContractEvent({
    address: opts.breedingContractAddress,
    abi: breedingContractAbi,
    eventName: "BreedingExecuted",
    fromBlock: opts.fromBlock,
    pollingInterval: opts.pollingIntervalMs,
    onLogs: async (logs) => {
      for (const entry of logs) {
        const args = entry.args as Record<string, unknown> | undefined;
        if (!args) continue;
        const event: BreedingEvent = {
          childTokenId: args.childTokenId as bigint,
          breeder: args.breeder as Address,
          parentA: args.parentA as bigint,
          parentB: args.parentB as bigint,
          totalFeesPaid: args.totalFeesPaid as bigint,
          blockNumber: entry.blockNumber ?? 0n,
          txHash: entry.transactionHash ?? "0x",
          logIndex: entry.logIndex ?? 0,
        };

        log?.info("breeding event received", {
          childTokenId: String(event.childTokenId),
          parentA: String(event.parentA),
          parentB: String(event.parentB),
          txHash: event.txHash,
        });

        try {
          await opts.onEvent(event);
        } catch (err) {
          log?.error("breeding handler failed", {
            childTokenId: String(event.childTokenId),
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
