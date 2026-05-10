import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address, PublicClient } from "viem";
import { startBreedingWatcher } from "./breeding-watcher.js";
import type { BreedingEvent } from "./types.js";

const BREEDING_ADDRESS: Address = "0x85985eDe5884C64fBf8daB26141ab2505eccadaf";
const ALICE: Address = "0x000000000000000000000000000000000000A1ce";

interface CapturedSubscription {
  address: Address;
  eventName: string;
  fromBlock?: bigint;
  pollingInterval?: number;
  onLogs: (logs: unknown[]) => void | Promise<void>;
  onError?: (err: Error) => void;
}

function createFakeClient() {
  const subscriptions: CapturedSubscription[] = [];
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];

  const publicClient = {
    watchContractEvent(args: CapturedSubscription) {
      subscriptions.push(args);
      const unsub = vi.fn();
      unsubscribes.push(unsub);
      return unsub;
    },
  } as unknown as PublicClient;

  return {
    publicClient,
    subscriptions,
    unsubscribes,
    async emit(logs: unknown[]) {
      for (const sub of subscriptions) {
        await sub.onLogs(logs);
      }
    },
    raiseError(err: Error) {
      for (const sub of subscriptions) {
        sub.onError?.(err);
      }
    },
  };
}

function bredLog(overrides: Partial<{
  childTokenId: bigint;
  breeder: Address;
  parentA: bigint;
  parentB: bigint;
  totalFeesPaid: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}> = {}) {
  return {
    args: {
      childTokenId: overrides.childTokenId ?? 3n,
      breeder: overrides.breeder ?? ALICE,
      parentA: overrides.parentA ?? 1n,
      parentB: overrides.parentB ?? 2n,
      totalFeesPaid: overrides.totalFeesPaid ?? 100n,
    },
    blockNumber: overrides.blockNumber ?? 100n,
    transactionHash: overrides.transactionHash ?? `0x${"a".repeat(64)}`,
    logIndex: overrides.logIndex ?? 0,
  };
}

describe("startBreedingWatcher", () => {
  let fake: ReturnType<typeof createFakeClient>;

  beforeEach(() => {
    fake = createFakeClient();
  });

  it("subscribes to the BreedingExecuted event with the supplied address", () => {
    const onEvent = vi.fn();
    startBreedingWatcher({
      publicClient: fake.publicClient,
      breedingContractAddress: BREEDING_ADDRESS,
      onEvent,
    });

    expect(fake.subscriptions).toHaveLength(1);
    const sub = fake.subscriptions[0]!;
    expect(sub.address).toEqual(BREEDING_ADDRESS);
    expect(sub.eventName).toEqual("BreedingExecuted");
  });

  it("forwards normalized events to the handler", async () => {
    const events: BreedingEvent[] = [];
    startBreedingWatcher({
      publicClient: fake.publicClient,
      breedingContractAddress: BREEDING_ADDRESS,
      onEvent: (e) => {
        events.push(e);
      },
    });

    await fake.emit([
      bredLog({ childTokenId: 7n, parentA: 4n, parentB: 5n, totalFeesPaid: 250n }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      childTokenId: 7n,
      parentA: 4n,
      parentB: 5n,
      totalFeesPaid: 250n,
      breeder: ALICE,
    });
  });

  it("delivers each log in a multi-log batch in order", async () => {
    const seen: bigint[] = [];
    startBreedingWatcher({
      publicClient: fake.publicClient,
      breedingContractAddress: BREEDING_ADDRESS,
      onEvent: (e) => {
        seen.push(e.childTokenId);
      },
    });

    await fake.emit([
      bredLog({ childTokenId: 10n, logIndex: 0 }),
      bredLog({ childTokenId: 11n, logIndex: 1 }),
      bredLog({ childTokenId: 12n, logIndex: 2 }),
    ]);

    expect(seen).toEqual([10n, 11n, 12n]);
  });

  it("does not stop the subscription when a handler throws", async () => {
    const seen: bigint[] = [];
    startBreedingWatcher({
      publicClient: fake.publicClient,
      breedingContractAddress: BREEDING_ADDRESS,
      onEvent: (e) => {
        seen.push(e.childTokenId);
        if (e.childTokenId === 1n) throw new Error("boom");
      },
    });

    await fake.emit([bredLog({ childTokenId: 1n })]);
    await fake.emit([bredLog({ childTokenId: 2n })]);

    expect(seen).toEqual([1n, 2n]);
    expect(fake.unsubscribes[0]?.mock.calls).toHaveLength(0);
  });

  it("returns the viem unsubscribe function", () => {
    const unsub = startBreedingWatcher({
      publicClient: fake.publicClient,
      breedingContractAddress: BREEDING_ADDRESS,
      onEvent: vi.fn(),
    });

    expect(typeof unsub).toEqual("function");
    unsub();
    expect(fake.unsubscribes[0]).toHaveBeenCalledTimes(1);
  });

  it("skips logs that have no decoded args", async () => {
    const onEvent = vi.fn();
    startBreedingWatcher({
      publicClient: fake.publicClient,
      breedingContractAddress: BREEDING_ADDRESS,
      onEvent,
    });

    await fake.emit([{ args: undefined, blockNumber: 1n, transactionHash: "0x", logIndex: 0 }]);

    expect(onEvent).not.toHaveBeenCalled();
  });
});
