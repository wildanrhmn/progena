"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CircleHalf, Sparkle } from "@phosphor-icons/react";
import { displayNameOf, useFounders } from "@/hooks/use-agents";
import {
  formatRelative,
  formatScore,
  shortAddress,
  shortHash,
} from "@/lib/format";

export function FoundersStrip() {
  const { agents, isLoading } = useFounders(4);

  return (
    <section className="border-t border-border-soft bg-background px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-end justify-between gap-6 border-b border-border-soft pb-6">
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              The founders
            </div>
            <h2 className="text-balance text-3xl tracking-tight text-foreground sm:text-4xl">
              Four genesis seeds, live on{" "}
              <span className="font-display italic text-accent-life">
                mainnet
              </span>
              .
            </h2>
          </div>
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
                className="h-44 animate-pulse rounded-lg border border-border-soft bg-muted/20"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.id.toString()}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link
                  href={`/agents/${agent.id.toString()}`}
                  className="group block h-full rounded-lg border border-border-soft bg-muted/20 p-5 transition-colors hover:border-border hover:bg-muted/40"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <CircleHalf
                      size={20}
                      weight="duotone"
                      className="text-accent-life"
                    />
                    <span className="rounded-full border border-accent-life/30 bg-accent-life/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-life">
                      Genesis
                    </span>
                  </div>

                  <div className="mb-1 text-base font-medium text-foreground">
                    {displayNameOf(agent)}
                  </div>
                  <div className="mb-5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    #{agent.id.toString()} · {formatRelative(agent.bornAt)}
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="mb-0.5 text-muted-foreground">
                        Reputation
                      </div>
                      <div className="font-mono text-sm tabular-nums text-foreground">
                        {formatScore(agent.score)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center gap-1 text-muted-foreground">
                        <Sparkle size={10} weight="bold" />
                        Rounds
                      </div>
                      <div className="font-mono text-sm tabular-nums text-foreground">
                        {agent.rounds.toString()}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border-soft pt-3 text-[11px] font-mono text-muted-foreground">
                    <div className="mb-0.5">
                      hash {shortHash(agent.rootHash, 6, 4)}
                    </div>
                    <div>by {shortAddress(agent.owner)}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
