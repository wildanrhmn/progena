import { agentGenomeAbi, type RootHash } from "@progena/sdk";
import {
  getContract,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { AgentRegistry } from "./types.js";

export interface CreateAgentRegistryOptions {
  address: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export function createAgentRegistry(opts: CreateAgentRegistryOptions): AgentRegistry {
  const client = getContract({
    address: opts.address,
    abi: agentGenomeAbi,
    client: { public: opts.publicClient, wallet: opts.walletClient },
  });

  return {
    async rootHashOf(tokenId) {
      const result = await client.read.rootHashOf([tokenId]);
      return result as RootHash;
    },

    async finalizeChild(tokenId, rootHash) {
      const account = opts.walletClient.account;
      if (!account) throw new Error("walletClient must have an account configured");
      const txHash = (await client.write.setRootHash([tokenId, rootHash], {
        account,
        chain: opts.walletClient.chain ?? null,
      })) as Hex;
      await opts.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    },
  };
}
