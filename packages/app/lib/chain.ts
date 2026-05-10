import { zgGalileo, zgMainnet } from "@progena/sdk";
import type { Address } from "viem";

const DEFAULT_ADDRESSES = {
  agentGenome: "0xCe2AA403276D01919295823237123C0ac47A24e2",
  breedingContract: "0x85985eDe5884C64fBf8daB26141ab2505eccadaf",
  royaltySplitter: "0xB95865FBde4385c607EF95f768DE76f44cf42efA",
  reputationOracle: "0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea",
  predictionRound: "0x17e111593242AC706509D7e9EB676A5602277Df4",
  agentMemory: "0x55CeB5f91B1806B2F52c8eeAE3181632B90Bb449",
  agentRegistry: "0x4560a71a07cf8172cfb0bf61b96a5480255cec8d",
} as const satisfies Record<string, Address>;

const fromEnvOrDefault = (envName: string, fallback: Address): Address => {
  const v = process.env[envName];
  if (!v || v.length === 0) return fallback;
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) {
    if (typeof window === "undefined") {
      console.warn(`[chain] ${envName} is not a valid address, using default`);
    }
    return fallback;
  }
  return v as Address;
};

export const NETWORK_NAME =
  (process.env.NEXT_PUBLIC_NETWORK as "mainnet" | "galileo" | undefined) ?? "mainnet";

export const chain = NETWORK_NAME === "galileo" ? zgGalileo : zgMainnet;

export const ADDRESSES = {
  agentGenome: fromEnvOrDefault("NEXT_PUBLIC_AGENT_GENOME", DEFAULT_ADDRESSES.agentGenome),
  breedingContract: fromEnvOrDefault(
    "NEXT_PUBLIC_BREEDING_CONTRACT",
    DEFAULT_ADDRESSES.breedingContract
  ),
  royaltySplitter: fromEnvOrDefault(
    "NEXT_PUBLIC_ROYALTY_SPLITTER",
    DEFAULT_ADDRESSES.royaltySplitter
  ),
  reputationOracle: fromEnvOrDefault(
    "NEXT_PUBLIC_REPUTATION_ORACLE",
    DEFAULT_ADDRESSES.reputationOracle
  ),
  predictionRound: fromEnvOrDefault(
    "NEXT_PUBLIC_PREDICTION_ROUND",
    DEFAULT_ADDRESSES.predictionRound
  ),
  agentMemory: fromEnvOrDefault("NEXT_PUBLIC_AGENT_MEMORY", DEFAULT_ADDRESSES.agentMemory),
  agentRegistry: fromEnvOrDefault(
    "NEXT_PUBLIC_AGENT_REGISTRY",
    DEFAULT_ADDRESSES.agentRegistry
  ),
} as const;

export const EXPLORER_URL = chain.blockExplorers?.default?.url ?? "https://chainscan.0g.ai";
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0]!;
