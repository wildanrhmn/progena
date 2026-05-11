import {
  agentGenomeAbi,
  agentMemoryAbi,
  agentMetadataAbi,
  breedingContractAbi,
  predictionRoundAbi,
  reputationOracleAbi,
  roundMetadataAbi,
  royaltySplitterAbi,
} from "@progena/sdk";
import { ADDRESSES } from "./chain";

export const agentGenomeContract = {
  address: ADDRESSES.agentGenome,
  abi: agentGenomeAbi,
} as const;

export const breedingContract = {
  address: ADDRESSES.breedingContract,
  abi: breedingContractAbi,
} as const;

export const royaltySplitterContract = {
  address: ADDRESSES.royaltySplitter,
  abi: royaltySplitterAbi,
} as const;

export const reputationOracleContract = {
  address: ADDRESSES.reputationOracle,
  abi: reputationOracleAbi,
} as const;

export const predictionRoundContract = {
  address: ADDRESSES.predictionRound,
  abi: predictionRoundAbi,
} as const;

export const agentMemoryContract = {
  address: ADDRESSES.agentMemory,
  abi: agentMemoryAbi,
} as const;

export const agentMetadataContract = {
  address: ADDRESSES.agentMetadata,
  abi: agentMetadataAbi,
} as const;

export const roundMetadataContract = {
  address: ADDRESSES.roundMetadata,
  abi: roundMetadataAbi,
} as const;
