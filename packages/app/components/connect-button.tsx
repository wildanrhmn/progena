"use client";

import { usePrivy } from "@privy-io/react-auth";
import { CaretDown, SignOut, Wallet } from "@phosphor-icons/react";
import { useState } from "react";

export function ConnectButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [open, setOpen] = useState(false);

  if (!ready) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-md border border-border-soft bg-muted/40" />
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90"
      >
        <Wallet size={16} weight="bold" />
        Sign in
      </button>
    );
  }

  const address =
    user?.wallet?.address ??
    user?.linkedAccounts?.find((a) => a.type === "wallet")?.address ??
    null;

  const display = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : user?.email?.address?.split("@")[0] ?? "Connected";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground transition-colors hover:border-muted-foreground"
      >
        <span className="h-2 w-2 rounded-full bg-accent-life" />
        <span className="font-mono text-xs">{display}</span>
        <CaretDown size={12} weight="bold" className="text-muted-foreground" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-background shadow-lg">
            {address && (
              <div className="border-b border-border-soft px-3 py-2 text-[11px] text-muted-foreground">
                <div className="mb-1 uppercase tracking-wider">Wallet</div>
                <div className="font-mono text-foreground">{display}</div>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <SignOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
