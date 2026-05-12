"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CircleNotch,
  Copy,
  Quotes,
  Sparkle,
  Target,
  Trophy,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useShard, type MemoryShard } from "@/hooks/use-shard";
import { ADDRESSES, EXPLORER_URL } from "@/lib/chain";
import { formatRelative, formatTimestamp, shortHash } from "@/lib/format";

type Props = {
  open: boolean;
  rootHash: string | undefined;
  shardIndex: number | undefined;
  onClose: () => void;
  previewShard?: MemoryShard;
};

function formatBps(bps: number): string {
  const n = Number.isFinite(bps) ? bps : 0;
  return `${(n / 100).toFixed(2)}%`;
}

function formatDelta(delta: number): { text: string; tone: string } {
  const sign = delta > 0 ? "+" : "";
  const text = `${sign}${(delta / 100).toFixed(2)}`;
  if (delta > 0) return { text, tone: "text-accent-life" };
  if (delta < 0) return { text, tone: "text-red-400" };
  return { text, tone: "text-foreground" };
}

export function ShardModal({ open, rootHash, shardIndex, onClose, previewShard }: Props) {
  const fetched = useShard(open && !previewShard ? rootHash : undefined);
  const shard = previewShard ?? fetched.shard;
  const isLoading = previewShard ? false : fetched.isLoading;
  const error = previewShard ? null : fetched.error;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const copyHash = async () => {
    if (!rootHash) return;
    try {
      await navigator.clipboard.writeText(rootHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* */
    }
  };

  if (typeof document === "undefined") return null;

  const predictionPct = shard ? Math.max(0, Math.min(100, shard.myPrediction / 100)) : 0;
  const outcomePct = shard ? Math.max(0, Math.min(100, shard.actualOutcome / 100)) : 0;
  const missBps = shard ? Math.abs(shard.myPrediction - shard.actualOutcome) : 0;
  const derivedScore = shard ? 10000 - 2 * missBps : 0;
  const delta = shard ? formatDelta(derivedScore) : null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-10">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[calc(100vh-5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-2xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-lineage/70 to-transparent"
            />

            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-100"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>

            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <Sparkle size={11} weight="bold" />
              Memory shard{shardIndex !== undefined ? ` #${shardIndex}` : ""}
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              What this agent learned
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Downloaded from 0G Storage · rootHash anchored on AgentMemory contract
            </p>

            <div className="mt-5">
              {isLoading && (
                <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-sm text-muted-foreground">
                  <CircleNotch size={14} className="animate-spin" />
                  Fetching shard from 0G Storage…
                </div>
              )}

              {error && !isLoading && (
                <div className="flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                  <Warning size={14} weight="bold" className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Couldn't load this shard</div>
                    <div className="mt-1 text-xs text-red-300/70">{error.message}</div>
                  </div>
                </div>
              )}

              {shard && !isLoading && !error && (
                <div className="space-y-5">
                  <blockquote className="relative rounded-md border border-accent-lineage/30 bg-accent-lineage/[0.06] px-5 py-4">
                    <Quotes
                      size={14}
                      weight="fill"
                      className="absolute left-3 top-3 text-accent-lineage/60"
                    />
                    <p className="pl-5 text-sm italic leading-relaxed text-foreground">
                      {shard.lesson}
                    </p>
                  </blockquote>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-white/55">
                      <span className="flex items-center gap-1.5">
                        <Target size={11} weight="bold" />
                        Prediction vs outcome
                      </span>
                      <span className="font-mono normal-case tracking-normal text-muted-foreground">
                        miss {formatBps(missBps)}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <BarRow
                        label="My prediction"
                        value={formatBps(shard.myPrediction)}
                        pct={predictionPct}
                        tone="accent-life"
                      />
                      <BarRow
                        label="Actual outcome"
                        value={formatBps(shard.actualOutcome)}
                        pct={outcomePct}
                        tone="accent-lineage"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-md border border-zinc-800 bg-zinc-900/30 p-3 text-xs">
                    <KV label="Round">
                      <Link
                        href={`/rounds/${shard.roundId}`}
                        className="font-mono text-foreground transition-colors hover:text-accent-life"
                      >
                        #{shard.roundId}
                      </Link>
                    </KV>
                    <KV label="Score delta">
                      <span className={`font-mono ${delta?.tone}`}>
                        <Trophy size={10} weight="bold" className="mr-1 inline" />
                        {delta?.text}
                      </span>
                    </KV>
                    <KV label="Recorded">
                      <span
                        className="font-mono text-foreground"
                        title={formatTimestamp(shard.recordedAt)}
                      >
                        {formatRelative(shard.recordedAt)}
                      </span>
                    </KV>
                  </div>

                  {shard.openclawReasoning && (
                    <div className="space-y-2 rounded-md border border-accent-lineage/30 bg-accent-lineage/[0.04] p-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-accent-lineage/90">
                        <span>OpenClaw pass 1 · workspace-materialized reasoning</span>
                        <span className="font-mono normal-case tracking-normal text-accent-lineage/70">
                          openclaw agent
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85">
                        {shard.openclawReasoning.length > 800
                          ? `${shard.openclawReasoning.slice(0, 800)}…`
                          : shard.openclawReasoning}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Genome materialized into an OpenClaw workspace; agent reasoned in
                        agent-mode with SOUL.md as personality, before tool execution.
                      </p>
                    </div>
                  )}

                  {shard.toolCalls && shard.toolCalls.length > 0 && (
                    <div className="space-y-2 rounded-md border border-accent-life/30 bg-accent-life/[0.04] p-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-accent-life/90">
                        <span>Pass 2 · tool calls (function-calling via 0G Compute)</span>
                        <span className="font-mono normal-case tracking-normal text-accent-life/70">
                          {shard.toolCalls.length} call{shard.toolCalls.length === 1 ? "" : "s"}
                          {shard.inferenceIterations
                            ? ` · ${shard.inferenceIterations} turns`
                            : ""}
                        </span>
                      </div>
                      <ol className="space-y-2 text-xs">
                        {shard.toolCalls.map((c, i) => (
                          <li key={i} className="rounded border border-white/5 bg-zinc-950/60 p-2">
                            <div className="flex items-center justify-between font-mono text-[10px] text-accent-life">
                              <span>
                                {c.ok ? "✓" : "✗"} {c.tool}
                              </span>
                              <span className="text-muted-foreground">{c.durationMs}ms</span>
                            </div>
                            {c.args && Object.keys(c.args).length > 0 && (
                              <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                                {JSON.stringify(c.args)}
                              </div>
                            )}
                            <div className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[11px] text-foreground/85">
                              {c.summary}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="space-y-2 border-t border-zinc-800/80 pt-4">
                    <div className="text-[11px] uppercase tracking-wider text-white/55">
                      0G Storage rootHash
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                      <span className="flex-1 truncate font-mono text-xs text-foreground">
                        {rootHash}
                      </span>
                      <button
                        type="button"
                        onClick={copyHash}
                        className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100"
                        title={copied ? "Copied!" : "Copy rootHash"}
                      >
                        <Copy size={12} weight="bold" />
                      </button>
                    </div>
                    <a
                      href={`${EXPLORER_URL}/address/${ADDRESSES.agentMemory}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-accent-life"
                    >
                      View AgentMemory contract on 0G chainscan
                      <ArrowUpRight size={10} weight="bold" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function BarRow({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: "accent-life" | "accent-lineage";
}) {
  const fill = tone === "accent-life" ? "bg-accent-life/80" : "bg-accent-lineage/80";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full ${fill}`}
        />
      </div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      {children}
    </div>
  );
}
