import type { HardhatUserConfig } from "hardhat/config";
import HardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config";

const TESTNET_KEY = process.env.PRIVATE_KEY_TESTNET;
const MAINNET_KEY = process.env.PRIVATE_KEY_MAINNET;

const config: HardhatUserConfig = {
  plugins: [HardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    galileo: {
      type: "http",
      url: process.env.ZG_TESTNET_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: TESTNET_KEY ? [TESTNET_KEY] : [],
    },
    mainnet: {
      type: "http",
      url: process.env.ZG_MAINNET_RPC_URL ?? "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: MAINNET_KEY ? [MAINNET_KEY] : [],
    },
  },
};

export default config;
