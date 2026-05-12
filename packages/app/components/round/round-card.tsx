"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import {
  ArrowUpRight,
  Lightning,
  MagnifyingGlass,
  Sparkle,
  Trophy,
  Users,
} from "@phosphor-icons/react";
import type { RoundData } from "@/hooks/use-rounds";
import { useRoundQuestion } from "@/hooks/use-round-question";
import {
  useRoundLifecycle,
  type RoundLifecyclePhase,
} from "@/hooks/use-round-lifecycle";

const CLIP =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)";
const EASE = [0.16, 1, 0.3, 1] as const;

const PHASE_PALETTE: Record<
  RoundLifecyclePhase,
  { chip: string; glow: string; accent: string; label: string }
> = {
  "awaiting-commits": {
    chip: "text-accent-life border-accent-life/40 bg-accent-life/10",
    glow: "oklch(0.74 0.18 162 / 0.25)",
    accent: "var(--accent-life)",
    label: "OPEN",
  },
  "commits-closing": {
    chip: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    glow: "oklch(0.78 0.17 70 / 0.28)",
    accent: "oklch(0.78 0.17 70)",
    label: "CLOSING",
  },
  "awaiting-reveals": {
    chip: "text-accent-lineage border-accent-lineage/40 bg-accent-lineage/10",
    glow: "oklch(0.7 0.18 290 / 0.25)",
    accent: "var(--accent-lineage)",
    label: "REVEALING",
  },
  "reveals-closing": {
    chip: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    glow: "oklch(0.78 0.17 70 / 0.28)",
    accent: "oklch(0.78 0.17 70)",
    label: "REVEALS CLOSING",
  },
  "awaiting-oracle": {
    chip: "text-accent-lineage border-accent-lineage/40 bg-accent-lineage/10",
    glow: "oklch(0.7 0.18 290 / 0.32)",
    accent: "var(--accent-lineage)",
    label: "RESEARCHING",
  },
  resolved: {
    chip: "text-accent-life border-accent-life/50 bg-accent-life/15",
    glow: "oklch(0.74 0.18 162 / 0.28)",
    accent: "var(--accent-life)",
    label: "RESOLVED",
  },
  "non-existent": {
    chip: "text-zinc-400 border-zinc-700 bg-zinc-900/50",
    glow: "transparent",
    accent: "var(--accent-life)",
    label: "LOADING",
  },
};

function PhaseIcon({ phase }: { phase: RoundLifecyclePhase }) {
  if (phase === "awaiting-oracle")
    return <MagnifyingGlass size={11} weight="bold" />;
  if (phase === "resolved") return <Trophy size={11} weight="fill" />;
  if (phase === "commits-closing" || phase === "reveals-closing")
    return <Lightning size={11} weight="fill" />;
  return <Sparkle size={11} weight="fill" />;
}

export function RoundCard({
  round,
  index = 0,
}: {
  round: RoundData;
  index?: number;
}) {
  const { text: question } = useRoundQuestion(round.id);
  const lifecycle = useRoundLifecycle(round);
  const palette = PHASE_PALETTE[lifecycle.phase];

  const isResolved = lifecycle.phase === "resolved";
  const isResearching = lifecycle.phase === "awaiting-oracle";
  const showCountdown = !isResolved && !isResearching;
  const countdownLabel = showCountdown
    ? lifecycle.countdownLabel
    : isResolved
      ? `${(round.outcome / 100).toFixed(2)}%`
      : "—";
  const countdownCaption = isResolved
    ? "outcome"
    : isResearching
      ? "researching"
      : lifecycle.phase === "commits-closing" ||
          lifecycle.phase === "awaiting-commits"
        ? "entries close in"
        : "reveals close in";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: EASE,
        delay: Math.min(index, 8) * 0.04,
      }}
      className="p-px"
      style={{
        clipPath: CLIP,
        background: "rgba(255,255,255,0.18)",
      }}
    >
      <Link
        href={`/rounds/${round.id.toString()}`}
        className="group relative block h-full overflow-hidden bg-[#0a0a0a] text-foreground transition-colors hover:bg-[#0d0d0d]"
        style={{ clipPath: CLIP }}
        aria-label={`Open round #${round.id}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full opacity-70 blur-[80px] transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: palette.glow }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, " +
              palette.accent +
              ", transparent)",
            opacity: 0.7,
          }}
        />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.16em] ${palette.chip}`}
            >
              <PhaseIcon phase={lifecycle.phase} />
              {palette.label}
            </span>
            <ArrowUpRight
              size={14}
              weight="bold"
              className="text-white/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </div>

          <div className="mt-4">
            {question ? (
              <h3 className="line-clamp-3 font-display text-xl leading-snug tracking-tight text-foreground sm:text-2xl">
                {question}
              </h3>
            ) : (
              <div className="space-y-1.5">
                <div className="h-5 w-3/4 animate-pulse rounded bg-zinc-800/60" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-800/60" />
                <p className="text-xs text-muted-foreground">
                  Loading question text…
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 font-mono text-xs text-muted-foreground">
            Round #{round.id.toString()}
          </div>
        </div>

        <div className="relative grid grid-cols-2 gap-4 border-t border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-white/65">
              {countdownCaption}
            </div>
            <motion.div
              key={countdownLabel}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="font-display text-2xl font-light tabular-nums"
              style={{ color: palette.accent }}
            >
              {countdownLabel}
            </motion.div>
          </div>
          <div className="text-right">
            <div className="mb-1 text-xs uppercase tracking-wider text-white/65">
              Prize pool
            </div>
            <div className="font-display text-2xl font-light text-accent-life tabular-nums">
              {formatEther(round.totalPool)} <span className="text-base text-accent-life/70">OG</span>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-xs text-muted-foreground sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <Users size={11} weight="bold" />
            {round.totalCommitted.toString()} agent
            {round.totalCommitted === 1n ? "" : "s"} in
            {isResolved && (
              <>
                <span className="mx-1">·</span>
                {round.totalRevealed.toString()} revealed
              </>
            )}
          </span>
          <span className="font-mono">
            entry {formatEther(round.entryFee)} OG
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
