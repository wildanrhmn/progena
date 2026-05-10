"use client";

import Link from "next/link";
import makeBlockie from "ethereum-blockies-base64";
import { ArrowUpRight } from "@phosphor-icons/react";
import { useMemo } from "react";
import { displayNameOf, useAgents } from "@/hooks/use-agents";
import { useNames } from "@/hooks/use-names";
import {
  formatRelative,
  shortAddress,
  shortHash,
} from "@/lib/format";
import { SectionHeader } from "./section-header";

function eventLabel(generation: number): { label: string; tone: string } {
  if (generation === 0)
    return { label: "Genesis Mint", tone: "text-accent-life" };
  return { label: `Bred · Gen ${generation}`, tone: "text-accent-lineage" };
}

export function LiveActivityFeed() {
  const { agents, isLoading } = useAgents(8);
  const parentIds = useMemo(
    () =>
      agents
        .filter((a) => a.generation > 0)
        .flatMap((a) => [a.parentA, a.parentB]),
    [agents]
  );
  const parentNames = useNames(parentIds);

  return (
    <section
      id="live-feed"
      className="relative mx-auto mt-8 w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6"
    >
      <SectionHeader eyebrow="Live mainnet activity" />

      <div className="relative border border-dashed border-white/18 bg-[#1c1c1c2e] p-5 backdrop-blur-md sm:p-7">
        <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-white/70" />
        <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-white/70" />
        <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-white/70" />
        <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-white/70" />

        <div className="hidden grid-cols-[1.45fr_1.55fr_0.9fr_0.85fr_0.65fr] items-center gap-4 border-b border-white/10 pb-4 text-[11px] uppercase tracking-[0.16em] text-white/55 xl:grid">
          <p>Agent</p>
          <p>Event</p>
          <p>Lineage</p>
          <p>Root hash</p>
          <p className="text-right">When</p>
        </div>

        {isLoading && agents.length === 0 ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded bg-white/5"
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/55">
            No on-chain activity yet.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {agents.map((agent) => {
              const { label, tone } = eventLabel(agent.generation);
              const lineage =
                agent.generation === 0
                  ? "genesis seed"
                  : `${parentNames.get(agent.parentA.toString()) ?? `#${agent.parentA.toString()}`} × ${parentNames.get(agent.parentB.toString()) ?? `#${agent.parentB.toString()}`}`;
              return (
                <Link
                  key={agent.id.toString()}
                  href={`/agents/${agent.id.toString()}`}
                  className="group grid gap-3 py-4 transition hover:bg-white/[0.03] xl:grid-cols-[1.45fr_1.55fr_0.9fr_0.85fr_0.65fr] xl:items-center xl:gap-4"
                  aria-label={`Open ${displayNameOf(agent)}`}
                >
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={makeBlockie(agent.owner)}
                      alt=""
                      className="h-9 w-9 rounded-sm border border-white/15"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {displayNameOf(agent)}
                      </p>
                      <p className="font-mono text-xs text-accent-life/80">
                        {shortAddress(agent.owner)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className={`text-sm ${tone}`}>{label}</p>
                    <p className="text-xs text-foreground/55">
                      Token #{agent.id.toString()}
                    </p>
                  </div>

                  <p className="truncate text-xs text-foreground/85">
                    {lineage}
                  </p>

                  <p className="font-mono text-xs text-foreground/70">
                    {shortHash(agent.rootHash, 6, 4)}
                  </p>

                  <div className="inline-flex items-center justify-end gap-2 text-right text-xs text-foreground/65">
                    <span>{formatRelative(agent.bornAt)}</span>
                    <ArrowUpRight
                      size={14}
                      weight="bold"
                      className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
