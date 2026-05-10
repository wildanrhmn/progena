import {
  getContract,
  type Address,
  type GetContractReturnType,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  agentGenomeAbi,
  breedingContractAbi,
  royaltySplitterAbi,
  reputationOracleAbi,
  predictionRoundAbi,
  agentMemoryAbi,
} from "./abis/index.js";

export interface ProgenaAddresses {
  agentGenome: Address;
  breedingContract: Address;
  royaltySplitter: Address;
  reputationOracle: Address;
  predictionRound: Address;
  agentMemory: Address;
}

export interface ContractClientOptions {
  address: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

export interface ProgenaClientOptions {
  addresses: ProgenaAddresses;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

type Clients = { public: PublicClient; wallet?: WalletClient };

export type AgentGenomeClient = GetContractReturnType<typeof agentGenomeAbi, Clients, Address>;
export type BreedingContractClient = GetContractReturnType<
  typeof breedingContractAbi,
  Clients,
  Address
>;
export type RoyaltySplitterClient = GetContractReturnType<
  typeof royaltySplitterAbi,
  Clients,
  Address
>;
export type ReputationOracleClient = GetContractReturnType<
  typeof reputationOracleAbi,
  Clients,
  Address
>;
export type PredictionRoundClient = GetContractReturnType<
  typeof predictionRoundAbi,
  Clients,
  Address
>;
export type AgentMemoryClient = GetContractReturnType<typeof agentMemoryAbi, Clients, Address>;

function clientArg(opts: ContractClientOptions): Clients {
  return opts.walletClient
    ? { public: opts.publicClient, wallet: opts.walletClient }
    : { public: opts.publicClient };
}

export function createAgentGenomeClient(opts: ContractClientOptions): AgentGenomeClient {
  return getContract({
    address: opts.address,
    abi: agentGenomeAbi,
    client: clientArg(opts),
  }) as AgentGenomeClient;
}

export function createBreedingContractClient(opts: ContractClientOptions): BreedingContractClient {
  return getContract({
    address: opts.address,
    abi: breedingContractAbi,
    client: clientArg(opts),
  }) as BreedingContractClient;
}

export function createRoyaltySplitterClient(opts: ContractClientOptions): RoyaltySplitterClient {
  return getContract({
    address: opts.address,
    abi: royaltySplitterAbi,
    client: clientArg(opts),
  }) as RoyaltySplitterClient;
}

export function createReputationOracleClient(
  opts: ContractClientOptions
): ReputationOracleClient {
  return getContract({
    address: opts.address,
    abi: reputationOracleAbi,
    client: clientArg(opts),
  }) as ReputationOracleClient;
}

export function createPredictionRoundClient(opts: ContractClientOptions): PredictionRoundClient {
  return getContract({
    address: opts.address,
    abi: predictionRoundAbi,
    client: clientArg(opts),
  }) as PredictionRoundClient;
}

export function createAgentMemoryClient(opts: ContractClientOptions): AgentMemoryClient {
  return getContract({
    address: opts.address,
    abi: agentMemoryAbi,
    client: clientArg(opts),
  }) as AgentMemoryClient;
}

export interface ProgenaClient {
  agentGenome: AgentGenomeClient;
  breedingContract: BreedingContractClient;
  royaltySplitter: RoyaltySplitterClient;
  reputationOracle: ReputationOracleClient;
  predictionRound: PredictionRoundClient;
  agentMemory: AgentMemoryClient;
  addresses: ProgenaAddresses;
}

export function createProgenaClient(opts: ProgenaClientOptions): ProgenaClient {
  const common = { publicClient: opts.publicClient, walletClient: opts.walletClient };
  return {
    agentGenome: createAgentGenomeClient({ ...common, address: opts.addresses.agentGenome }),
    breedingContract: createBreedingContractClient({
      ...common,
      address: opts.addresses.breedingContract,
    }),
    royaltySplitter: createRoyaltySplitterClient({
      ...common,
      address: opts.addresses.royaltySplitter,
    }),
    reputationOracle: createReputationOracleClient({
      ...common,
      address: opts.addresses.reputationOracle,
    }),
    predictionRound: createPredictionRoundClient({
      ...common,
      address: opts.addresses.predictionRound,
    }),
    agentMemory: createAgentMemoryClient({
      ...common,
      address: opts.addresses.agentMemory,
    }),
    addresses: opts.addresses,
  };
}
