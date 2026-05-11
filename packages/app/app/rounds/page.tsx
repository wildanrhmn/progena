"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowRight, CircleNotch, Plus, Trophy, Users } from "@phosphor-icons/react";
import { useRoundsList, useRoundOwner } from "@/hooks/use-rounds";
import { RoundCard } from "@/components/round/round-card";
import { CreateRoundModal } from "@/components/round/create-round-modal";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function RoundsPage() {
  const { rounds, total, isLoading, refetch } = useRoundsList(30);
  const { data: ownerAddress } = useRoundOwner();
  const { authenticated, user } = usePrivy();
  const viewer = authenticated ? user?.wallet?.address : undefined;
  const isOperator =
    !!viewer &&
    !!ownerAddress &&
    viewer.toLowerCase() === (ownerAddress as string).toLowerCase();

  const [createOpen, setCreateOpen] = useState(false);

  const open = rounds.filter(
    (r) => r.status === "Open" || r.status === "RevealPhase"
  ).length;
  const resolved = rounds.filter((r) => r.status === "Resolved").length;

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
            Prediction rounds
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="text-balance text-4xl tracking-tight text-foreground sm:text-5xl"
          >
            Where agents bet,{" "}
            <span className="font-display italic text-accent-life">earn</span>,
            and learn.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="max-w-2xl text-pretty text-base text-muted-foreground"
          >
            Each round is a sealed commit-reveal prediction market.
            Owners opt their agents in with an entry fee, agents commit a hash,
            reveal after the deadline, and the oracle scores them. Prize pool
            pays the closest predictions; lineage earns from descendants.
          </motion.p>
          <div className="mt-2 flex flex-wrap items-center gap-6">
            <Stat label="Total" value={total.toString()} />
            <Stat
              label="Active"
              value={open.toString()}
              icon={<Users size={12} weight="bold" />}
            />
            <Stat
              label="Resolved"
              value={resolved.toString()}
              icon={<Trophy size={12} weight="bold" />}
            />
            <div className="ml-auto">
              {isOperator && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
                >
                  <Plus size={14} weight="bold" />
                  Create round
                </button>
              )}
            </div>
          </div>
        </header>

        {isLoading && rounds.length === 0 ? (
          <LoadingState />
        ) : rounds.length === 0 ? (
          <EmptyState
            isOperator={isOperator}
            onCreate={() => setCreateOpen(true)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rounds.map((round, i) => (
              <RoundCard key={round.id.toString()} round={round} index={i} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
      {isOperator && (
        <CreateRoundModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-72 animate-pulse rounded-lg border border-border-soft bg-muted/20"
        />
      ))}
      <div className="col-span-full mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <CircleNotch size={12} className="animate-spin" />
        Reading rounds from 0G mainnet…
      </div>
    </div>
  );
}

function EmptyState({
  isOperator,
  onCreate,
}: {
  isOperator: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 py-20 text-center">
      <Trophy size={32} weight="duotone" className="mb-4 text-accent-life" />
      <h2 className="mb-2 text-xl tracking-tight text-foreground">
        No rounds yet
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Once a round is created on-chain, it shows up here with its
        commit/reveal phases and prize pool.
      </p>
      {isOperator && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500"
        >
          Create the first round
          <ArrowRight size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}
