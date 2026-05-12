"use client";

import { motion } from "framer-motion";
import { CheckCircle, CircleNotch, Lightning, MagnifyingGlass } from "@phosphor-icons/react";
import type { RoundData } from "@/hooks/use-rounds";
import { useRoundLifecycle, type RoundLifecyclePhase } from "@/hooks/use-round-lifecycle";

type Props = { round: RoundData };

const PHASES: Array<{
  id: RoundLifecyclePhase;
  label: string;
}> = [
  { id: "awaiting-commits", label: "Owners entering" },
  { id: "awaiting-reveals", label: "Daemon revealing" },
  { id: "awaiting-oracle", label: "Research oracle" },
  { id: "resolved", label: "Resolved" },
];

function phaseIndex(phase: RoundLifecyclePhase): number {
  switch (phase) {
    case "awaiting-commits":
    case "commits-closing":
      return 0;
    case "awaiting-reveals":
    case "reveals-closing":
      return 1;
    case "awaiting-oracle":
      return 2;
    case "resolved":
      return 3;
    default:
      return -1;
  }
}

export function RoundLifecycleTicker({ round }: Props) {
  const lifecycle = useRoundLifecycle(round);
  const activeIdx = phaseIndex(lifecycle.phase);

  return (
    <div className="rounded-lg border border-accent-life/30 bg-accent-life/[0.03] p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-accent-life/80">
        <Lightning size={11} weight="fill" />
        Autonomous orchestrator
      </div>

      <div className="mt-3 flex items-center gap-3">
        {lifecycle.daemonActive && (
          <CircleNotch size={16} className="animate-spin text-accent-life" />
        )}
        {lifecycle.phase === "resolved" && (
          <CheckCircle size={16} weight="fill" className="text-accent-life" />
        )}
        {lifecycle.phase === "awaiting-oracle" && !lifecycle.daemonActive && (
          <MagnifyingGlass size={16} weight="bold" className="text-accent-life" />
        )}
        <div className="flex-1">
          <div className="text-base font-medium tracking-tight text-foreground">
            {lifecycle.headline}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {lifecycle.detail}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {PHASES.map((p, i) => {
          const state =
            activeIdx === -1
              ? "pending"
              : i < activeIdx
                ? "done"
                : i === activeIdx
                  ? "active"
                  : "pending";
          return (
            <div key={p.id} className="flex flex-1 items-center gap-2">
              <div
                className={
                  state === "done"
                    ? "h-1.5 w-1.5 shrink-0 rounded-full bg-accent-life"
                    : state === "active"
                      ? "h-1.5 w-1.5 shrink-0 rounded-full bg-accent-life animate-pulse"
                      : "h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700"
                }
              />
              <span
                className={
                  state === "active"
                    ? "text-[10px] uppercase tracking-wider text-accent-life"
                    : state === "done"
                      ? "text-[10px] uppercase tracking-wider text-zinc-400"
                      : "text-[10px] uppercase tracking-wider text-zinc-600"
                }
              >
                {p.label}
              </span>
              {i < PHASES.length - 1 && (
                <div
                  className={
                    state === "done"
                      ? "h-px flex-1 bg-accent-life/40"
                      : "h-px flex-1 bg-zinc-800"
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {lifecycle.daemonActive && lifecycle.countdownSeconds > 0 && (
        <motion.div
          key={lifecycle.countdownLabel}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex items-baseline gap-2 border-t border-white/5 pt-3"
        >
          <span className="text-[10px] uppercase tracking-wider text-white/45">
            Next phase in
          </span>
          <span className="font-mono text-lg text-foreground tabular-nums">
            {lifecycle.countdownLabel}
          </span>
        </motion.div>
      )}
    </div>
  );
}
