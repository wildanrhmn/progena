import type { PublicClient } from "viem";
import { ToolRegistry } from "./registry.js";
import { createWebSearchTool } from "./web-search.js";
import { createFetchTokenPriceTool } from "./fetch-token-price.js";
import { createReadOnChainTool } from "./read-on-chain.js";
import { createFetchMarketStateTool } from "./fetch-market-state.js";

export * from "./types.js";
export * from "./registry.js";
export * from "./alias.js";

export interface BuildToolRegistryOptions {
  publicClient: PublicClient;
  addresses: {
    agentGenome: `0x${string}`;
    agentMemory: `0x${string}`;
    reputationOracle: `0x${string}`;
    predictionRound: `0x${string}`;
    agentMetadata: `0x${string}`;
  };
  tavilyApiKey?: string;
}

export function buildDefaultToolRegistry(opts: BuildToolRegistryOptions): ToolRegistry {
  const reg = new ToolRegistry();

  if (opts.tavilyApiKey && opts.tavilyApiKey.length > 0) {
    reg.register(createWebSearchTool({ apiKey: opts.tavilyApiKey }));
  }

  reg.register(createFetchTokenPriceTool());

  reg.register(
    createReadOnChainTool({
      publicClient: opts.publicClient,
      addresses: {
        agentGenome: opts.addresses.agentGenome,
        agentMemory: opts.addresses.agentMemory,
        reputationOracle: opts.addresses.reputationOracle,
        predictionRound: opts.addresses.predictionRound,
      },
    })
  );

  reg.register(
    createFetchMarketStateTool({
      publicClient: opts.publicClient,
      predictionRoundAddress: opts.addresses.predictionRound,
      agentMetadataAddress: opts.addresses.agentMetadata,
    })
  );

  return reg;
}
