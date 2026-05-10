"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowRight,
  CircleNotch,
  GitBranch,
  Sparkle,
  Wallet,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type { Address } from "viem";
import { useOwnedAgents } from "@/hooks/use-owned-agents";
import { useNames } from "@/hooks/use-names";
import { AgentCard } from "@/components/agent-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { shortAddress } from "@/lib/format";

export default function PortfolioPage() {
  const { ready, authenticated, user, login } = usePrivy();
  const viewer = (
    authenticated ? user?.wallet?.address : undefined
  ) as Address | undefined;
  const { agents, ownedCount, isLoading } = useOwnedAgents(viewer);

  const parentIds = useMemo(
    () =>
      agents
        .filter((a) => a.generation > 0)
        .flatMap((a) => [a.parentA, a.parentB]),
    [agents]
  );
  const parentNames = useNames(parentIds);

  const genesisCount = agents.filter((a) => a.generation === 0).length;
  const bredCount = agents.length - genesisCount;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pt-28 pb-24 sm:pt-32">
        <header className="mb-12 flex flex-col gap-4 border-b border-border-soft pb-10">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            Portfolio
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="text-balance text-4xl tracking-tight text-foreground sm:text-5xl"
          >
            Agents{" "}
            <span className="font-display italic text-accent-life">
              you own
            </span>
            .
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="max-w-2xl text-pretty text-base text-muted-foreground"
          >
            Read straight from the AgentGenome contract. Each entry is yours to
            breed, name, set a stud fee on, or opt into the next prediction
            round.
          </motion.p>
          {viewer && (
            <div className="mt-2 flex flex-wrap items-center gap-6 text-sm">
              <Stat label="Owner" value={shortAddress(viewer)} mono />
              <Stat label="Total" value={ownedCount.toString()} />
              <Stat
                label="Genesis"
                value={genesisCount.toString()}
                icon={<Sparkle size={12} weight="bold" />}
              />
              <Stat
                label="Bred"
                value={bredCount.toString()}
                icon={<GitBranch size={12} weight="bold" />}
              />
            </div>
          )}
        </header>

        {!ready ? (
          <LoadingPlaceholder text="Initialising session…" />
        ) : !authenticated || !viewer ? (
          <ConnectPrompt onConnect={login} />
        ) : isLoading && agents.length === 0 ? (
          <LoadingPlaceholder text="Reading your agents from 0G mainnet…" />
        ) : agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent, i) => (
              <AgentCard
                key={agent.id.toString()}
                agent={agent}
                index={i}
                parentNames={parentNames}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`tabular-nums text-foreground ${
          mono ? "font-mono text-xs" : "font-mono text-sm"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[26rem] animate-pulse rounded-lg border border-border-soft bg-muted/20"
        />
      ))}
      <div className="col-span-full mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <CircleNotch size={12} className="animate-spin" />
        {text}
      </div>
    </div>
  );
}

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 py-20 text-center">
      <Wallet size={32} weight="duotone" className="mb-4 text-accent-life" />
      <h2 className="mb-2 text-xl tracking-tight text-foreground">
        Connect your wallet
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Sign in via Privy to view the agents you own, set stud fees, claim
        names, and queue them into prediction rounds.
      </p>
      <button
        onClick={onConnect}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-colors hover:bg-emerald-500"
      >
        <Wallet size={15} weight="bold" />
        Sign in
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 py-20 text-center">
      <h2 className="mb-2 text-xl tracking-tight text-foreground">
        No agents in this wallet
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Browse the registry to find an agent to breed with, or wait for the
        next genesis drop.
      </p>
      <Link
        href="/agents"
        className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
      >
        Browse all agents
        <ArrowRight size={14} weight="bold" />
      </Link>
    </div>
  );
}
