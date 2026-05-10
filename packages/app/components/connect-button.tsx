"use client";

import { usePrivy } from "@privy-io/react-auth";
import { CaretDown, SignOut, Wallet } from "@phosphor-icons/react";
import { useState } from "react";

export function ConnectButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [open, setOpen] = useState(false);

  if (!ready) {
    return (
      <div className="h-10 w-28 animate-pulse rounded-full border border-zinc-800/60 bg-zinc-900/40" />
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all hover:bg-emerald-500"
      >
        <Wallet size={15} weight="bold" />
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
        className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-4 text-sm text-zinc-100 transition-colors hover:border-zinc-700"
      >
        <span className="h-2 w-2 rounded-full bg-accent-life shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
        <span className="font-mono text-xs text-zinc-200">{display}</span>
        <CaretDown size={12} weight="bold" className="text-zinc-500" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl shadow-xl">
            {address && (
              <div className="border-b border-zinc-800/80 px-4 py-3 text-[11px] text-zinc-500">
                <div className="mb-1 uppercase tracking-wider">Wallet</div>
                <div className="font-mono text-sm text-zinc-100">{display}</div>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
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
