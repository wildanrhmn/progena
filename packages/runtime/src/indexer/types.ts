import type { Address, Hex } from "viem";

export interface BreedingEvent {
  childTokenId: bigint;
  breeder: Address;
  parentA: bigint;
  parentB: bigint;
  totalFeesPaid: bigint;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}

export interface RoundCreatedEvent {
  roundId: bigint;
  questionHash: Hex;
  commitDeadline: bigint;
  revealDeadline: bigint;
  entryFee: bigint;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}

export type Unsubscribe = () => void;

export type BreedingHandler = (event: BreedingEvent) => void | Promise<void>;
export type RoundCreatedHandler = (event: RoundCreatedEvent) => void | Promise<void>;
