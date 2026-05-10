"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useFounders } from "@/hooks/use-agents";
import { AgentCard } from "@/components/agent-card";
import { SectionHeader } from "./section-header";

export function FoundersStrip() {
  const { agents, isLoading } = useFounders(4);

  return (
    <section className="relative mx-auto mt-4 w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <SectionHeader eyebrow="The founders" />

      <div className="mb-8 flex items-end justify-between gap-6">
        <h2 className="text-balance text-3xl tracking-tight text-foreground sm:text-4xl">
          Four genesis seeds, live on{" "}
          <span className="font-display italic text-accent-life">mainnet</span>.
        </h2>
        <Link
          href="/agents"
          className="hidden shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          Browse all
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      {isLoading && agents.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[26rem] animate-pulse rounded-lg border border-border-soft bg-muted/20"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {agents.map((agent, i) => (
            <AgentCard
              key={agent.id.toString()}
              agent={agent}
              index={i}
            />
          ))}
        </div>
      )}
    </section>
  );
}
