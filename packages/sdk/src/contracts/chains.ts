import { defineChain } from "viem";

export const ZG_GALILEO_CHAIN_ID = 16602;
export const ZG_MAINNET_CHAIN_ID = 16661;

export const ZG_GALILEO_RPC_URL = "https://evmrpc-testnet.0g.ai";
export const ZG_MAINNET_RPC_URL = "https://evmrpc.0g.ai";

export const ZG_GALILEO_EXPLORER_URL = "https://chainscan-galileo.0g.ai";
export const ZG_MAINNET_EXPLORER_URL = "https://chainscan.0g.ai";

export const zgGalileo = defineChain({
  id: ZG_GALILEO_CHAIN_ID,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: [ZG_GALILEO_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "ChainScan", url: ZG_GALILEO_EXPLORER_URL },
  },
  testnet: true,
});

export const zgMainnet = defineChain({
  id: ZG_MAINNET_CHAIN_ID,
  name: "0G",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: [ZG_MAINNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "ChainScan", url: ZG_MAINNET_EXPLORER_URL },
  },
});
