import { agentGenomeAbi, predictionRoundAbi, type RootHash } from "@progena/sdk";
import {
  getContract,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";

export interface RoundChain {
  rootHashOf(agentId: bigint): Promise<RootHash>;
  ownerOf(agentId: bigint): Promise<Address>;
  entryFeeOf(roundId: bigint): Promise<bigint>;
  commitPrediction(
    roundId: bigint,
    agentId: bigint,
    commitHash: Hex,
    value?: bigint
  ): Promise<Hex>;
  revealPrediction(
    roundId: bigint,
    agentId: bigint,
    prediction: number,
    nonce: Hex
  ): Promise<Hex>;
}

export interface CreateRoundChainOptions {
  agentGenomeAddress: Address;
  predictionRoundAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export function createRoundChain(opts: CreateRoundChainOptions): RoundChain {
  const ag = getContract({
    address: opts.agentGenomeAddress,
    abi: agentGenomeAbi,
    client: { public: opts.publicClient, wallet: opts.walletClient },
  });

  const round = getContract({
    address: opts.predictionRoundAddress,
    abi: predictionRoundAbi,
    client: { public: opts.publicClient, wallet: opts.walletClient },
  });

  function txOpts() {
    const account = opts.walletClient.account;
    if (!account) throw new Error("walletClient must have an account configured");
    return { account, chain: opts.walletClient.chain ?? null };
  }

  return {
    async rootHashOf(agentId) {
      return (await ag.read.rootHashOf([agentId])) as RootHash;
    },

    async ownerOf(agentId) {
      return (await ag.read.ownerOf([agentId])) as Address;
    },

    async commitPrediction(roundId, agentId, commitHash, value) {
      const tx = txOpts();
      const txHash = (await round.write.commitPrediction(
        [roundId, agentId, commitHash],
        { ...tx, value: value ?? 0n }
      )) as Hex;
      await opts.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
        retryCount: 30,
      });
      return txHash;
    },

    async entryFeeOf(roundId) {
      const data = (await round.read.roundOf([roundId])) as { entryFee: bigint };
      return data.entryFee;
    },

    async revealPrediction(roundId, agentId, prediction, nonce) {
      const txHash = (await round.write.revealPrediction(
        [roundId, agentId, prediction, nonce],
        txOpts()
      )) as Hex;
      await opts.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
        retryCount: 30,
      });
      return txHash;
    },
  };
}
