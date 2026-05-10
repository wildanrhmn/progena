import { agentMemoryAbi, type RootHash } from "@progena/sdk";
import {
  getContract,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { MemoryChain } from "./memory-accumulator.js";

export interface CreateMemoryChainOptions {
  agentMemoryAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export function createMemoryChain(opts: CreateMemoryChainOptions): MemoryChain {
  const memory = getContract({
    address: opts.agentMemoryAddress,
    abi: agentMemoryAbi,
    client: { public: opts.publicClient, wallet: opts.walletClient },
  });

  return {
    async addShard(agentId: bigint, shardRootHash: RootHash): Promise<Hex> {
      const account = opts.walletClient.account;
      if (!account) throw new Error("walletClient must have an account configured");
      const txHash = (await memory.write.addShard([agentId, shardRootHash], {
        account,
        chain: opts.walletClient.chain ?? null,
      })) as Hex;
      await opts.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
        retryCount: 30,
      });
      return txHash;
    },
  };
}
