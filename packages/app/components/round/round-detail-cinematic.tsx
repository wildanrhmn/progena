"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle,
  Eye,
  EyeSlash,
  Lightning,
  MagnifyingGlass,
  Sparkle,
  Trophy,
  Users,
} from "@phosphor-icons/react";
import { formatEther } from "viem";
import { Panel, BracketBox } from "@/components/ui/panel";
import { EXPLORER_URL } from "@/lib/chain";
import type { RoundData } from "@/hooks/use-rounds";
import type {
  RoundLifecycle,
  RoundLifecyclePhase,
} from "@/hooks/use-round-lifecycle";

export const CINEMATIC_EASE = [0.16, 1, 0.3, 1] as const;

export interface CommittedAgentView {
  id: bigint;
  name: string;
  generation: number;
  owner: `0x${string}`;
  ownerShort: string;
  isYou?: boolean;
  state: "sealed" | "revealed" | "missing";
  commitHash?: `0x${string}`;
  predictionBps?: number;
  scoreDeltaBps?: number;
}

const PHASE_COLOR: Record<
  RoundLifecyclePhase,
  { accent: string; glow: string; chip: string }
> = {
  "awaiting-commits": {
    accent: "var(--accent-life)",
    glow: "oklch(0.74 0.18 162 / 0.35)",
    chip: "text-accent-life border-accent-life/40 bg-accent-life/10",
  },
  "commits-closing": {
    accent: "oklch(0.78 0.17 70)",
    glow: "oklch(0.78 0.17 70 / 0.32)",
    chip: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  },
  "awaiting-reveals": {
    accent: "var(--accent-lineage)",
    glow: "oklch(0.7 0.18 290 / 0.32)",
    chip: "text-accent-lineage border-accent-lineage/40 bg-accent-lineage/10",
  },
  "reveals-closing": {
    accent: "oklch(0.78 0.17 70)",
    glow: "oklch(0.78 0.17 70 / 0.32)",
    chip: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  },
  "awaiting-oracle": {
    accent: "var(--accent-lineage)",
    glow: "oklch(0.7 0.18 290 / 0.4)",
    chip: "text-accent-lineage border-accent-lineage/40 bg-accent-lineage/10",
  },
  resolved: {
    accent: "var(--accent-life)",
    glow: "oklch(0.74 0.18 162 / 0.4)",
    chip: "text-accent-life border-accent-life/50 bg-accent-life/15",
  },
  "non-existent": {
    accent: "var(--accent-life)",
    glow: "oklch(0.74 0.18 162 / 0.2)",
    chip: "text-zinc-400 border-zinc-700 bg-zinc-900/50",
  },
};

const PHASE_CHIP_LABEL: Record<RoundLifecyclePhase, string> = {
  "awaiting-commits": "ENTRIES OPEN",
  "commits-closing": "CLOSING SOON",
  "awaiting-reveals": "RESOLVING",
  "reveals-closing": "FINALIZING",
  "awaiting-oracle": "RESEARCHING",
  resolved: "RESOLVED",
  "non-existent": "LOADING",
};

function fmtMmSs(s: number): string {
  const safe = Math.max(0, Math.floor(s));
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ExplorerLink({
  type = "tx",
  hash,
  label,
  compact,
}: {
  type?: "tx" | "address";
  hash: string;
  label?: string;
  compact?: boolean;
}) {
  const short = `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  return (
    <a
      href={`${EXPLORER_URL}/${type === "tx" ? "tx" : "address"}/${hash}`}
      target="_blank"
      rel="noreferrer"
      className={
        compact
          ? "inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-accent-life"
          : "inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-accent-life"
      }
    >
      {label && <span className="uppercase tracking-wider">{label}</span>}
      <span className="font-mono">{short}</span>
      <ArrowUpRight size={10} weight="bold" />
    </a>
  );
}

export function RoundHero({
  round,
  question,
  phase,
}: {
  round: RoundData;
  question: string | undefined;
  phase: RoundLifecyclePhase;
}) {
  const palette = PHASE_COLOR[phase];
  return (
    <Panel>
      <div className="relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full opacity-60 blur-[100px]"
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
          }}
        />

        <div className="relative flex flex-wrap items-center gap-3">
          <motion.span
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: CINEMATIC_EASE }}
            className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${palette.chip}`}
          >
            {PHASE_CHIP_LABEL[phase]}
          </motion.span>
          {round.resolved && (
            <span className="rounded-full border border-accent-life/40 bg-accent-life/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accent-life">
              Outcome {(round.outcome / 100).toFixed(2)}%
            </span>
          )}
          <div className="ml-auto font-mono text-xs text-muted-foreground">
            Round #{round.id.toString()}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: CINEMATIC_EASE, delay: 0.05 }}
          className="relative mt-6 max-w-3xl"
        >
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/65">
            Question
          </div>
          {question ? (
            <h2 className="text-balance font-display text-3xl leading-tight tracking-tight text-foreground sm:text-5xl">
              {question}
            </h2>
          ) : (
            <div className="space-y-1.5">
              <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-800/60" />
              <div className="h-8 w-1/2 animate-pulse rounded bg-zinc-800/60" />
              <p className="mt-1 text-xs text-muted-foreground">
                Loading question text…
              </p>
            </div>
          )}
        </motion.div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Entry fee"
            value={`${formatEther(round.entryFee)} OG`}
            delay={0.1}
          />
          <MetricTile
            label="Prize pool"
            value={`${formatEther(round.totalPool)} OG`}
            delay={0.15}
            tone="accent"
          />
          <MetricTile
            label="Agents in"
            value={round.totalCommitted.toString()}
            delay={0.2}
          />
          <MetricTile
            label="Revealed"
            value={round.totalRevealed.toString()}
            delay={0.25}
          />
        </div>
      </div>
    </Panel>
  );
}

function MetricTile({
  label,
  value,
  delay,
  tone,
}: {
  label: string;
  value: string;
  delay: number;
  tone?: "accent";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: CINEMATIC_EASE, delay }}
      className={
        tone === "accent"
          ? "rounded-md border border-accent-life/30 bg-accent-life/[0.05] p-3"
          : "rounded-md border border-white/10 bg-white/[0.02] p-3"
      }
    >
      <div className="mb-1 text-xs uppercase tracking-wider text-white/65">
        {label}
      </div>
      <div
        className={
          tone === "accent"
            ? "font-display text-2xl font-light text-accent-life tabular-nums"
            : "font-display text-2xl font-light text-foreground tabular-nums"
        }
      >
        {value}
      </div>
    </motion.div>
  );
}

export function RoundCountdown({
  lifecycle,
  outcomeBps,
}: {
  lifecycle: RoundLifecycle;
  outcomeBps?: number;
}) {
  if (lifecycle.phase === "resolved") {
    return <ResolvedOutcomeStrip outcomeBps={outcomeBps ?? 0} />;
  }
  if (lifecycle.phase === "awaiting-oracle") {
    return <OracleStrip headline={lifecycle.headline} />;
  }
  if (lifecycle.phase === "non-existent") {
    return (
      <div className="text-sm text-muted-foreground">Loading round state…</div>
    );
  }
  const palette = PHASE_COLOR[lifecycle.phase];
  const label =
    lifecycle.phase === "commits-closing" || lifecycle.phase === "awaiting-commits"
      ? "Entries close in"
      : "Resolve unlocks in";

  return (
    <div className="flex items-baseline gap-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/65">
        {label}
      </div>
      <motion.div
        key={lifecycle.countdownSeconds}
        initial={{ opacity: 0.7, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: CINEMATIC_EASE }}
        className="font-display text-5xl font-light tabular-nums"
        style={{ color: palette.accent }}
      >
        {lifecycle.countdownLabel}
      </motion.div>
    </div>
  );
}

function OracleStrip({ headline }: { headline: string }) {
  const queries = [
    "Reading the latest news",
    "Pulling live prices",
    "Checking on-chain state",
    "Cross-referencing sources",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => (i + 1) % queries.length),
      1800
    );
    return () => clearInterval(id);
  }, [queries.length]);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
        >
          <MagnifyingGlass
            size={20}
            weight="bold"
            className="text-accent-lineage"
          />
        </motion.div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-accent-lineage">
            Researching the answer
          </div>
          <div className="text-sm text-foreground">
            <AnimatePresence mode="wait">
              <motion.span
                key={idx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, ease: CINEMATIC_EASE }}
              >
                {queries[idx]}…
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="font-mono text-xs text-muted-foreground">{headline}</div>
    </div>
  );
}

function ResolvedOutcomeStrip({ outcomeBps }: { outcomeBps: number }) {
  const target = outcomeBps / 100;
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v: number) => `${v.toFixed(2)}%`);

  useEffect(() => {
    const controls = animate(mv, target, {
      duration: 1.4,
      ease: CINEMATIC_EASE,
    });
    return controls.stop;
  }, [target, mv]);

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
      <div className="flex items-baseline gap-4">
        <div className="text-xs uppercase tracking-[0.18em] text-accent-life/85">
          Truth
        </div>
        <motion.div className="font-display text-6xl font-light text-accent-life tabular-nums">
          {display}
        </motion.div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          probability the answer was YES
        </div>
      </div>
    </div>
  );
}

export function RoundPhaseTrack({ phase }: { phase: RoundLifecyclePhase }) {
  const stages: Array<{
    keys: RoundLifecyclePhase[];
    label: string;
    sub: string;
    icon: ReactNode;
  }> = [
    {
      keys: ["awaiting-commits", "commits-closing"],
      label: "Entries",
      sub: "Owners send agents in",
      icon: <Sparkle size={12} weight="fill" />,
    },
    {
      keys: ["awaiting-reveals", "reveals-closing"],
      label: "Resolving",
      sub: "Awaiting resolve window",
      icon: <EyeSlash size={12} weight="bold" />,
    },
    {
      keys: ["awaiting-oracle"],
      label: "Truth",
      sub: "Researching the answer",
      icon: <MagnifyingGlass size={12} weight="bold" />,
    },
    {
      keys: ["resolved"],
      label: "Resolved",
      sub: "Payouts ready",
      icon: <Trophy size={12} weight="fill" />,
    },
  ];

  const activeIdx = stages.findIndex((s) => s.keys.includes(phase));

  return (
    <Panel>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/65">
          <span>Round timeline</span>
          <span className="font-mono normal-case text-muted-foreground">
            phase {Math.max(0, activeIdx) + 1} of {stages.length}
          </span>
        </div>
        <div className="relative">
          <div className="absolute left-3 right-3 top-3 h-px bg-zinc-800" />
          <motion.div
            initial={false}
            animate={{
              width: `calc(${(Math.max(0, activeIdx) / (stages.length - 1)) * 100}% )`,
            }}
            transition={{ duration: 0.7, ease: CINEMATIC_EASE }}
            className="absolute left-3 top-3 h-px bg-accent-life/70"
          />
          <div className="relative grid grid-cols-4 gap-2">
            {stages.map((s, i) => {
              const state =
                i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
              return (
                <div key={s.label} className="flex flex-col items-start gap-1.5">
                  <motion.div
                    initial={false}
                    animate={
                      state === "active"
                        ? {
                            scale: [1, 1.18, 1],
                            boxShadow: [
                              "0 0 0 0 rgba(34,197,94,0)",
                              "0 0 0 6px rgba(34,197,94,0.18)",
                              "0 0 0 0 rgba(34,197,94,0)",
                            ],
                          }
                        : { scale: 1 }
                    }
                    transition={
                      state === "active"
                        ? {
                            duration: 1.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }
                        : { duration: 0.3 }
                    }
                    className={
                      state === "done"
                        ? "flex h-6 w-6 items-center justify-center rounded-full border border-accent-life bg-accent-life/80 text-zinc-950"
                        : state === "active"
                          ? "flex h-6 w-6 items-center justify-center rounded-full border border-accent-life bg-accent-life/15 text-accent-life"
                          : "flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-600"
                    }
                  >
                    {state === "done" ? (
                      <CheckCircle size={14} weight="fill" />
                    ) : (
                      s.icon
                    )}
                  </motion.div>
                  <div
                    className={
                      state === "active"
                        ? "text-xs uppercase tracking-wider text-accent-life"
                        : state === "done"
                          ? "text-xs uppercase tracking-wider text-zinc-300"
                          : "text-xs uppercase tracking-wider text-zinc-600"
                    }
                  >
                    {s.label}
                  </div>
                  <div className="text-sm leading-relaxed text-muted-foreground">
                    {s.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function YourTurnPanel({
  entryFee,
  urgent,
  ownedCount,
  onEnter,
}: {
  entryFee: bigint;
  urgent: boolean;
  ownedCount: number;
  onEnter: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: CINEMATIC_EASE, delay: 0.15 }}
    >
      <Panel>
        <div className="relative p-6 sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-60 blur-[80px]"
            style={{ background: "oklch(0.74 0.18 162 / 0.3)" }}
          />
          <div className="relative flex flex-wrap items-start gap-5">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent-life">
                <Lightning size={12} weight="fill" />
                Your turn
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">
                Send an agent in
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Pick one of your agents. We materialize their genome, run a
                two-pass inference — personality reasoning, then live
                research — and hand you a sealed commit hash to sign. Pays{" "}
                <span className="text-foreground">
                  {formatEther(entryFee)} OG
                </span>{" "}
                entry fee. If you win, you pull your share of the prize pool
                later.
              </p>
              {urgent && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs uppercase tracking-wider text-amber-300">
                  <Lightning size={10} weight="fill" />
                  Entries closing soon
                </div>
              )}
            </div>
            <motion.button
              type="button"
              onClick={onEnter}
              disabled={ownedCount === 0}
              whileHover={ownedCount === 0 ? undefined : { scale: 1.02 }}
              whileTap={ownedCount === 0 ? undefined : { scale: 0.98 }}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkle size={13} weight="fill" />
              {ownedCount === 0
                ? "No agents to enter"
                : `Enter agent · ${formatEther(entryFee)} OG`}
            </motion.button>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

export function RevealStatusPanel({
  revealed,
  total,
  urgent,
}: {
  revealed: number;
  total: number;
  urgent: boolean;
}) {
  const pct = total === 0 ? 0 : Math.min(100, (revealed / total) * 100);
  const allRevealed = total > 0 && revealed === total;
  return (
    <Panel>
      <div className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full opacity-50 blur-[90px]"
          style={{ background: "oklch(0.7 0.18 290 / 0.35)" }}
        />
        <div className="relative">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent-lineage">
            <EyeSlash size={12} weight="bold" />
            {allRevealed
              ? "All predictions revealed — awaiting resolve window"
              : "Revealing predictions on-chain"}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div className="font-display text-3xl font-light text-foreground tabular-nums">
              {revealed}
              <span className="text-muted-foreground"> / {total}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {allRevealed
                ? "predictions are now public on-chain"
                : "predictions revealed so far"}
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-900">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, ease: CINEMATIC_EASE }}
              className="h-full bg-accent-lineage/80"
            />
          </div>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            {allRevealed
              ? "The PredictionRound contract requires the reveal window to elapse before resolveRound can be called. Once the timer hits zero the oracle posts the outcome."
              : "Progena reveals each sealed prediction for you automatically using the nonce saved at entry time. You don't have to come back."}
          </p>
          {urgent && !allRevealed && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs uppercase tracking-wider text-amber-300">
              <Lightning size={10} weight="fill" />
              Reveal window closing — unrevealed entries forfeit
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function OracleResearchPanel() {
  return (
    <Panel>
      <div className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-[90px]"
          style={{ background: "oklch(0.7 0.18 290 / 0.4)" }}
        />
        <div className="relative grid gap-3 sm:grid-cols-[1fr_auto] sm:gap-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent-lineage">
              <MagnifyingGlass size={12} weight="bold" />
              Researching the answer
            </div>
            <h3 className="font-display text-2xl tracking-tight text-foreground">
              An AI is reading the world to find the truth
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              The protocol runs a research model with live tool access — web
              search, on-chain reads, price feeds — and asks it to derive the
              outcome from real evidence. The answer it lands on becomes the
              ground-truth every prediction is scored against.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 self-start text-xs uppercase tracking-wider text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-lineage" />
              web search · live
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-lineage" />
              price feed · live
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
              on-chain · idle
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ResolvedSummaryPanel({
  yourAgents,
  onOpenShard,
}: {
  yourAgents: Array<{ id: bigint; rootHash?: `0x${string}`; latestShardIdx?: number }>;
  onOpenShard?: (rootHash: `0x${string}`, idx: number) => void;
}) {
  const claimable = yourAgents.find((a) => a.rootHash);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: CINEMATIC_EASE, delay: 0.1 }}
    >
      <Panel>
        <div className="relative overflow-hidden p-6 sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full opacity-50 blur-[90px]"
            style={{ background: "oklch(0.74 0.18 162 / 0.4)" }}
          />
          <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent-life">
                <Trophy size={12} weight="fill" />
                Round complete
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">
                Memory shards anchored · payouts unlocked
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Each agent's prediction is now scored against the truth. Each
                writes a memory shard to 0G Storage — the closer the
                prediction, the bigger the score delta. Top performers may
                even level up with a new earned skill they keep forever.
              </p>
            </div>
            {claimable && claimable.rootHash && onOpenShard && (
              <button
                type="button"
                onClick={() =>
                  onOpenShard(claimable.rootHash!, claimable.latestShardIdx ?? 0)
                }
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-opacity hover:opacity-90"
              >
                <Eye size={12} weight="bold" />
                Open your shard
              </button>
            )}
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

export function CommittedAgents({
  agents,
  phase,
}: {
  agents: CommittedAgentView[];
  phase: RoundLifecyclePhase;
}) {
  return (
    <Panel>
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/65">
            <Users size={12} weight="bold" />
            Agents in this round
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {agents.length}
          </span>
        </div>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents in yet. Be the first.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {agents.map((row, i) => (
              <motion.li
                key={row.id.toString()}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  ease: CINEMATIC_EASE,
                  delay: 0.04 * i + 0.05,
                }}
              >
                <CommittedAgentCard row={row} phase={phase} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function CommittedAgentCard({
  row,
  phase,
}: {
  row: CommittedAgentView;
  phase: RoundLifecyclePhase;
}) {
  const revealed = row.state === "revealed";
  const showScore = phase === "resolved" && row.scoreDeltaBps !== undefined;
  return (
    <BracketBox dotted={false} className="bg-zinc-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/agents/${row.id.toString()}`}
            className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground hover:text-accent-life"
          >
            {row.name}
            <ArrowUpRight
              size={11}
              weight="bold"
              className="text-muted-foreground"
            />
          </Link>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            #{row.id.toString()} · Gen {row.generation} ·{" "}
            {row.isYou ? (
              <span className="text-accent-life">you</span>
            ) : (
              row.ownerShort
            )}
          </div>
        </div>
        {revealed ? (
          <div className="text-right">
            <div className="font-mono text-xs uppercase tracking-wider text-accent-life">
              revealed
            </div>
            {(() => {
              const pct = (row.predictionBps ?? 0) / 100;
              const direction =
                pct > 50 ? "YES" : pct < 50 ? "NO" : "TOSSUP";
              const confidence =
                pct > 50 ? pct : pct < 50 ? 100 - pct : 50;
              return (
                <>
                  <div className="font-display text-xl font-light text-foreground tabular-nums">
                    {direction}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {direction === "TOSSUP"
                      ? "no lean"
                      : `${confidence.toFixed(2)}%`}
                  </div>
                </>
              );
            })()}
            {showScore && (
              <div
                className={
                  (row.scoreDeltaBps ?? 0) >= 0
                    ? "font-mono text-xs text-accent-life"
                    : "font-mono text-xs text-red-400"
                }
              >
                {(row.scoreDeltaBps ?? 0) >= 0 ? "+" : ""}
                {((row.scoreDeltaBps ?? 0) / 100).toFixed(2)} pts
              </div>
            )}
          </div>
        ) : (
          <div className="text-right">
            <div className="font-mono text-xs uppercase tracking-wider text-zinc-500">
              sealed
            </div>
            {row.commitHash && (
              <span
                className="font-mono text-xs text-muted-foreground"
                title={row.commitHash}
              >
                {row.commitHash.slice(0, 6)}…{row.commitHash.slice(-4)}
              </span>
            )}
          </div>
        )}
      </div>
    </BracketBox>
  );
}

export function RoundAnchors({
  round,
  predictionRoundAddress,
  roundMetadataAddress,
}: {
  round: RoundData;
  predictionRoundAddress: `0x${string}`;
  roundMetadataAddress: `0x${string}`;
}) {
  return (
    <Panel>
      <div className="p-6">
        <div className="mb-4 text-xs uppercase tracking-[0.18em] text-white/65">
          On-chain anchors
        </div>
        <dl className="grid gap-y-3 text-sm sm:grid-cols-[180px_1fr]">
          <dt className="text-muted-foreground">Round id</dt>
          <dd className="font-mono text-foreground">#{round.id.toString()}</dd>

          <dt className="text-muted-foreground">Question hash</dt>
          <dd className="break-all font-mono text-xs text-foreground">
            {round.questionHash}
          </dd>

          <dt className="text-muted-foreground">PredictionRound contract</dt>
          <dd>
            <ExplorerLink
              type="address"
              hash={predictionRoundAddress}
              label="explorer"
            />
          </dd>

          <dt className="text-muted-foreground">RoundMetadata contract</dt>
          <dd>
            <ExplorerLink
              type="address"
              hash={roundMetadataAddress}
              label="explorer"
            />
          </dd>
        </dl>
      </div>
    </Panel>
  );
}

export { fmtMmSs };
