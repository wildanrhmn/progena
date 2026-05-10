import { createConfig } from "@privy-io/wagmi";
import { http } from "viem";
import { zgGalileo, zgMainnet } from "@progena/sdk";

export const wagmiConfig = createConfig({
  chains: [zgMainnet, zgGalileo],
  transports: {
    [zgMainnet.id]: http(zgMainnet.rpcUrls.default.http[0]),
    [zgGalileo.id]: http(zgGalileo.rpcUrls.default.http[0]),
  },
});

export type WagmiConfig = typeof wagmiConfig;
