import { describe, it, expect } from "vitest";
import { createPublicClient, encodeFunctionData, http, type Address } from "viem";
import {
  agentGenomeAbi,
  breedingContractAbi,
  royaltySplitterAbi,
  reputationOracleAbi,
  predictionRoundAbi,
} from "./abis/index.js";
import {
  zgGalileo,
  zgMainnet,
  ZG_GALILEO_CHAIN_ID,
  ZG_MAINNET_CHAIN_ID,
  ZG_GALILEO_RPC_URL,
  ZG_MAINNET_RPC_URL,
} from "./chains.js";
import {
  createAgentGenomeClient,
  createBreedingContractClient,
  createRoyaltySplitterClient,
  createReputationOracleClient,
  createPredictionRoundClient,
  createProgenaClient,
  type ProgenaAddresses,
} from "./clients.js";

const ADDRESSES: ProgenaAddresses = {
  agentGenome: "0xCe2AA403276D01919295823237123C0ac47A24e2",
  breedingContract: "0x85985eDe5884C64fBf8daB26141ab2505eccadaf",
  royaltySplitter: "0xB95865FBde4385c607EF95f768DE76f44cf42efA",
  reputationOracle: "0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea",
  predictionRound: "0x54597AC54FCa99463B54bc85BA453111811C9BB7",
};

const STUB_ADDRESS: Address = "0x0000000000000000000000000000000000000001";

function abiHasFunction(abi: readonly unknown[], name: string): boolean {
  return abi.some(
    (entry): entry is { type: string; name: string } =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as Record<string, unknown>).type === "function" &&
      (entry as Record<string, unknown>).name === name
  );
}

function abiHasEvent(abi: readonly unknown[], name: string): boolean {
  return abi.some(
    (entry): entry is { type: string; name: string } =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as Record<string, unknown>).type === "event" &&
      (entry as Record<string, unknown>).name === name
  );
}

describe("chains", () => {
  it("Galileo has the expected id, rpc, and is marked testnet", () => {
    expect(zgGalileo.id).toEqual(ZG_GALILEO_CHAIN_ID);
    expect(zgGalileo.id).toEqual(16602);
    expect(zgGalileo.rpcUrls.default.http[0]).toEqual(ZG_GALILEO_RPC_URL);
    expect(zgGalileo.testnet).toEqual(true);
    expect(zgGalileo.nativeCurrency.symbol).toEqual("0G");
  });

  it("Mainnet has the expected id and rpc and is not testnet", () => {
    expect(zgMainnet.id).toEqual(ZG_MAINNET_CHAIN_ID);
    expect(zgMainnet.id).toEqual(16661);
    expect(zgMainnet.rpcUrls.default.http[0]).toEqual(ZG_MAINNET_RPC_URL);
    expect(zgMainnet.testnet).toBeFalsy();
    expect(zgMainnet.nativeCurrency.symbol).toEqual("0G");
  });
});

describe("abis", () => {
  it("AgentGenome ABI exposes the registry surface", () => {
    expect(abiHasFunction(agentGenomeAbi, "mintGenesis")).toBe(true);
    expect(abiHasFunction(agentGenomeAbi, "mintFromBreeding")).toBe(true);
    expect(abiHasFunction(agentGenomeAbi, "setRootHash")).toBe(true);
    expect(abiHasFunction(agentGenomeAbi, "agentOf")).toBe(true);
    expect(abiHasFunction(agentGenomeAbi, "ownerOf")).toBe(true);
    expect(abiHasEvent(agentGenomeAbi, "GenesisMinted")).toBe(true);
    expect(abiHasEvent(agentGenomeAbi, "Bred")).toBe(true);
  });

  it("BreedingContract ABI exposes the breeding surface", () => {
    expect(abiHasFunction(breedingContractAbi, "breed")).toBe(true);
    expect(abiHasFunction(breedingContractAbi, "setStudFee")).toBe(true);
    expect(abiHasFunction(breedingContractAbi, "quoteBreedingFee")).toBe(true);
    expect(abiHasEvent(breedingContractAbi, "BreedingExecuted")).toBe(true);
  });

  it("RoyaltySplitter ABI exposes distribution and withdraw", () => {
    expect(abiHasFunction(royaltySplitterAbi, "distribute")).toBe(true);
    expect(abiHasFunction(royaltySplitterAbi, "withdraw")).toBe(true);
    expect(abiHasFunction(royaltySplitterAbi, "pendingOf")).toBe(true);
    expect(abiHasEvent(royaltySplitterAbi, "Distributed")).toBe(true);
  });

  it("ReputationOracle ABI exposes record and view methods", () => {
    expect(abiHasFunction(reputationOracleAbi, "recordPerformance")).toBe(true);
    expect(abiHasFunction(reputationOracleAbi, "recordBatch")).toBe(true);
    expect(abiHasFunction(reputationOracleAbi, "scoreOf")).toBe(true);
    expect(abiHasEvent(reputationOracleAbi, "PerformanceRecorded")).toBe(true);
  });

  it("PredictionRound ABI exposes lifecycle methods", () => {
    expect(abiHasFunction(predictionRoundAbi, "createRound")).toBe(true);
    expect(abiHasFunction(predictionRoundAbi, "commitPrediction")).toBe(true);
    expect(abiHasFunction(predictionRoundAbi, "revealPrediction")).toBe(true);
    expect(abiHasFunction(predictionRoundAbi, "resolveRound")).toBe(true);
    expect(abiHasEvent(predictionRoundAbi, "RoundResolved")).toBe(true);
  });
});

describe("calldata encoding", () => {
  it("encodes mintGenesis on AgentGenome", () => {
    const data = encodeFunctionData({
      abi: agentGenomeAbi,
      functionName: "mintGenesis",
      args: [STUB_ADDRESS, `0x${"a".repeat(64)}`],
    });
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });

  it("encodes breed on BreedingContract", () => {
    const data = encodeFunctionData({
      abi: breedingContractAbi,
      functionName: "breed",
      args: [1n, 2n],
    });
    expect(data.startsWith("0x")).toBe(true);
  });

  it("encodes resolveRound on PredictionRound", () => {
    const data = encodeFunctionData({
      abi: predictionRoundAbi,
      functionName: "resolveRound",
      args: [1n, 7500],
    });
    expect(data.startsWith("0x")).toBe(true);
  });
});

describe("contract clients", () => {
  const publicClient = createPublicClient({ chain: zgGalileo, transport: http() });

  it("createAgentGenomeClient binds the address and exposes typed methods", () => {
    const client = createAgentGenomeClient({ address: STUB_ADDRESS, publicClient });
    expect(client.address).toEqual(STUB_ADDRESS);
    expect(typeof client.read.totalMinted).toEqual("function");
  });

  it("createBreedingContractClient exposes write surface only when wallet is supplied", () => {
    const readOnly = createBreedingContractClient({ address: STUB_ADDRESS, publicClient });
    expect(readOnly.address).toEqual(STUB_ADDRESS);
    expect(typeof readOnly.read.studFeeOf).toEqual("function");
  });

  it("createRoyaltySplitterClient is wired to the RoyaltySplitter ABI", () => {
    const client = createRoyaltySplitterClient({ address: STUB_ADDRESS, publicClient });
    expect(client.abi).toEqual(royaltySplitterAbi);
  });

  it("createReputationOracleClient is wired to the ReputationOracle ABI", () => {
    const client = createReputationOracleClient({ address: STUB_ADDRESS, publicClient });
    expect(client.abi).toEqual(reputationOracleAbi);
  });

  it("createPredictionRoundClient is wired to the PredictionRound ABI", () => {
    const client = createPredictionRoundClient({ address: STUB_ADDRESS, publicClient });
    expect(client.abi).toEqual(predictionRoundAbi);
  });

  it("createProgenaClient bundles all five contract clients", () => {
    const progena = createProgenaClient({ addresses: ADDRESSES, publicClient });
    expect(progena.agentGenome.address).toEqual(ADDRESSES.agentGenome);
    expect(progena.breedingContract.address).toEqual(ADDRESSES.breedingContract);
    expect(progena.royaltySplitter.address).toEqual(ADDRESSES.royaltySplitter);
    expect(progena.reputationOracle.address).toEqual(ADDRESSES.reputationOracle);
    expect(progena.predictionRound.address).toEqual(ADDRESSES.predictionRound);
    expect(progena.addresses).toEqual(ADDRESSES);
  });
});
