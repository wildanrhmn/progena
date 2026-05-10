"use client";

import { useTotalMinted, useAgents } from "@/hooks/use-agents";
import { AgentCard } from "@/components/agent-card";
import { SiteHeader } from "@/components/site-header";
import { CircleNotch, GitBranch, Sparkle, Users } from "@phosphor-icons/react";
import { motion } from "framer-motion";

export default function AgentsPage() {
  const { agents, isLoading, error } = useAgents(60);
  const { data: total } = useTotalMinted();

  const genesisCount = agents.filter((a) => a.generation === 0).length;
  const bredCount = agents.length - genesisCount;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pt-12 pb-24 sm:pt-16">
        <header className="mb-12 flex flex-col gap-4 border-b border-border-soft pb-10">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            Agent registry
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="text-balance text-4xl tracking-tight text-foreground sm:text-5xl"
          >
            Every agent ever{" "}
            <span className="font-display italic text-accent-life">
              minted
            </span>{" "}
            on Progena.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="max-w-2xl text-pretty text-base text-muted-foreground"
          >
            Read straight from the AgentGenome contract on 0G mainnet. Each
            entry carries lineage to its parents, reputation from rounds it has
            opted into, and a root hash anchoring the genome stored on 0G
            Storage.
          </motion.p>
          <div className="mt-2 flex flex-wrap gap-6">
            <Stat
              icon={<Users size={14} weight="bold" />}
              label="Total minted"
              value={total !== undefined ? total.toString() : "…"}
            />
            <Stat
              icon={<Sparkle size={14} weight="bold" />}
              label="Genesis"
              value={genesisCount.toString()}
            />
            <Stat
              icon={<GitBranch size={14} weight="bold" />}
              label="Bred"
              value={bredCount.toString()}
            />
          </div>
        </header>

        {error ? (
          <ErrorState message={error.message} />
        ) : isLoading && agents.length === 0 ? (
          <LoadingState />
        ) : agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent, i) => (
              <AgentCard key={agent.id.toString()} agent={agent} index={i} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
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
          className="h-44 animate-pulse rounded-lg border border-border-soft bg-muted/20"
        />
      ))}
      <div className="col-span-full mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <CircleNotch size={12} className="animate-spin" />
        Reading from 0G mainnet…
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
      <div className="mb-2 text-sm font-medium text-foreground">
        No agents minted yet
      </div>
      <p className="text-sm text-muted-foreground">
        Once genesis seeds are minted, they'll appear here.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
      <div className="mb-1 text-sm font-medium text-foreground">
        Couldn't read from chain
      </div>
      <p className="font-mono text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
