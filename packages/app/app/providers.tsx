"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { chain } from "@/lib/chain";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );

  if (!APP_ID) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-md border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          <div className="mb-2 font-medium text-foreground">
            Privy app ID not configured
          </div>
          Sign up free at{" "}
          <a
            href="https://dashboard.privy.io"
            target="_blank"
            rel="noreferrer"
            className="text-accent-life underline-offset-2 hover:underline"
          >
            dashboard.privy.io
          </a>{" "}
          and set <code className="text-foreground">NEXT_PUBLIC_PRIVY_APP_ID</code> in{" "}
          <code className="text-foreground">.env.local</code>.
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#34d399",
          logo: undefined,
          showWalletLoginFirst: false,
        },
        loginMethods: ["email", "wallet", "google", "twitter"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: chain,
        supportedChains: [chain],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
