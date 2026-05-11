import { zgGalileo, zgMainnet } from "@progena/sdk";
import type { Address } from "viem";

const DEFAULT_ADDRESSES = {
  agentGenome: "0xCe2AA403276D01919295823237123C0ac47A24e2",
  breedingContract: "0x85985eDe5884C64fBf8daB26141ab2505eccadaf",
  royaltySplitter: "0xB95865FBde4385c607EF95f768DE76f44cf42efA",
  reputationOracle: "0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea",
  predictionRound: "0x17e111593242AC706509D7e9EB676A5602277Df4",
  agentMemory: "0x55CeB5f91B1806B2F52c8eeAE3181632B90Bb449",
  agentMetadata: "0xfc3590a397f8fc0e729a5bcfe6a1040da20e432b",
  roundMetadata: "0x884b9c792ec6423e3005c689e47a3f24247d3c5a",
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
  agentMetadata: fromEnvOrDefault(
    "NEXT_PUBLIC_AGENT_METADATA",
    DEFAULT_ADDRESSES.agentMetadata
  ),
  roundMetadata: fromEnvOrDefault(
    "NEXT_PUBLIC_ROUND_METADATA",
    DEFAULT_ADDRESSES.roundMetadata
  ),
} as const;

export const EXPLORER_URL = chain.blockExplorers?.default?.url ?? "https://chainscan.0g.ai";
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0]!;

const DEFAULT_INDEXER_URL =
  NETWORK_NAME === "galileo"
    ? "https://indexer-storage-testnet-turbo.0g.ai"
    : "https://indexer-storage-turbo.0g.ai";

export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ??
  process.env.ZG_INDEXER_URL ??
  DEFAULT_INDEXER_URL;
