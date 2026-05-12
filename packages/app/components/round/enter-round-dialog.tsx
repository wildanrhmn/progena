"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { formatEther, type Address } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  ArrowRight,
  Brain,
  CircleNotch,
  Lightning,
  Sparkle,
  Target,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { predictionRoundContract } from "@/lib/contracts";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";

type Props = {
  roundId: bigint;
  entryFee: bigint;
  ownedAgents: AgentRow[];
  question: string | undefined;
  open: boolean;
  ownerAddress?: Address;
  onClose: () => void;
  onSuccess?: () => void;
  demoMode?: boolean;
  previewPrepared?: PreparedCommit;
};

type Phase =
  | "pick"
  | "preparing"
  | "preview"
  | "signing"
  | "confirming"
  | "done"
  | "error";

interface PreparedCommit {
  agentId: string;
  prediction: number;
  commitHash: `0x${string}`;
  nonce: `0x${string}`;
  questionHash: `0x${string}`;
  reasoningPreview?: string;
  openclawReasoning?: string;
  toolCalls?: Array<{
    tool: string;
    args: Record<string, unknown>;
    summary: string;
    ok: boolean;
    durationMs: number;
  }>;
  inferenceModel?: string;
  inferenceIterations?: number;
}

export function EnterRoundDialog({
  roundId,
  entryFee,
  ownedAgents,
  question,
  open,
  ownerAddress,
  onClose,
  onSuccess,
  demoMode,
  previewPrepared,
}: Props) {
  const [agentId, setAgentId] = useState<bigint | undefined>(ownedAgents[0]?.id);
  const [phase, setPhase] = useState<Phase>("pick");
  const [prepared, setPrepared] = useState<PreparedCommit | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [demoTxHash, setDemoTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract, data: writeTxHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: writeTxHash,
  });

  const txHash = demoMode ? demoTxHash : writeTxHash;

  useEffect(() => {
    if (demoMode) return;
    if (isPending) setPhase("signing");
    else if (confirming) setPhase("confirming");
    else if (isSuccess) setPhase("done");
  }, [isPending, confirming, isSuccess, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    if (isSuccess && open) {
      onSuccess?.();
      const t = setTimeout(() => {
        onClose();
        resetAll();
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [isSuccess, open, onSuccess, onClose, demoMode]);

  const resetAll = () => {
    setPhase("pick");
    setPrepared(undefined);
    setError(undefined);
    setDemoTxHash(undefined);
    reset();
  };

  const close = () => {
    if (phase === "preparing" || phase === "signing" || phase === "confirming")
      return;
    onClose();
    resetAll();
  };

  const runInference = async () => {
    if (agentId === undefined) {
      setError("Pick an agent");
      return;
    }
    setError(undefined);
    setPhase("preparing");

    if (demoMode && previewPrepared) {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      setPrepared(previewPrepared);
      setPhase("preview");
      return;
    }

    try {
      const res = await fetch(`/api/rounds/${roundId.toString()}/prepare-commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agentId.toString(),
          ownerAddress,
        }),
      });
      const body = (await res.json()) as PreparedCommit | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `prepare failed: ${res.status}`;
        setError(msg);
        setPhase("error");
        return;
      }
      setPrepared(body);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
      setPhase("error");
    }
  };

  const sign = () => {
    if (!prepared || agentId === undefined) return;
    if (demoMode) {
      setPhase("signing");
      setTimeout(() => {
        setDemoTxHash(
          "0xdeadbeef000000000000000000000000000000000000000000000000beadfeed"
        );
        setPhase("confirming");
        setTimeout(() => setPhase("done"), 1600);
      }, 1200);
      return;
    }
    writeContract({
      ...predictionRoundContract,
      functionName: "commitPrediction",
      args: [roundId, agentId, prepared.commitHash],
      value: entryFee,
    });
  };

  const predictionPct = prepared ? prepared.prediction / 100 : 0;

  if (typeof document === "undefined") return null;

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
            onClick={close}
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
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-life/70 to-transparent"
            />
            <button
              onClick={close}
              className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-100"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>

            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent-life/80">
              <Lightning size={11} weight="fill" />
              Round #{roundId.toString()} · enter
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              Send an agent into this round
            </h3>
            {question && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {question}
              </p>
            )}

            {(phase === "pick" || phase === "preparing" || phase === "error") && (
              <PickAgentStep
                ownedAgents={ownedAgents}
                agentId={agentId}
                onChange={setAgentId}
                preparing={phase === "preparing"}
                error={error}
              />
            )}

            {phase === "preview" && prepared && (
              <PreviewStep prepared={prepared} predictionPct={predictionPct} />
            )}

            {(phase === "signing" || phase === "confirming" || phase === "done") &&
              prepared && (
                <SubmitStatusStep
                  phase={phase}
                  predictionPct={predictionPct}
                  txHash={txHash}
                />
              )}

            <DialogFooter
              entryFee={entryFee}
              phase={phase}
              ownedAgentsCount={ownedAgents.length}
              agentId={agentId}
              onRun={runInference}
              onSign={sign}
              onRetry={() => setPhase("pick")}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function PickAgentStep({
  ownedAgents,
  agentId,
  onChange,
  preparing,
  error,
}: {
  ownedAgents: AgentRow[];
  agentId: bigint | undefined;
  onChange: (id: bigint) => void;
  preparing: boolean;
  error?: string;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div>
        <label className="mb-2 block text-[11px] uppercase tracking-wider text-zinc-500">
          Pick one of your agents
        </label>
        {ownedAgents.length === 0 ? (
          <p className="rounded-md border border-amber-700/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-200">
            You don't own any agents. Breed one first.
          </p>
        ) : (
          <div className="space-y-2">
            {ownedAgents.map((a) => {
              const checked = agentId === a.id;
              return (
                <button
                  key={a.id.toString()}
                  type="button"
                  disabled={preparing}
                  onClick={() => onChange(a.id)}
                  className={
                    checked
                      ? "flex w-full items-center justify-between rounded-md border border-accent-life/50 bg-accent-life/10 px-3 py-2.5 text-left transition-colors"
                      : "flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left transition-colors hover:border-zinc-600 disabled:opacity-50"
                  }
                >
                  <div>
                    <div className="text-sm text-foreground">{displayNameOf(a)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      #{a.id.toString()} · Gen {a.generation}
                    </div>
                  </div>
                  <div
                    className={
                      checked
                        ? "h-2.5 w-2.5 rounded-full bg-accent-life"
                        : "h-2.5 w-2.5 rounded-full border border-zinc-600"
                    }
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {preparing && (
        <div className="space-y-2 rounded-md border border-accent-lineage/30 bg-accent-lineage/[0.05] p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent-lineage">
            <CircleNotch size={11} className="animate-spin" />
            Running 2-pass inference on 0G Compute
          </div>
          <ul className="space-y-1 text-xs text-foreground/80">
            <li>· Materializing genome into OpenClaw workspace</li>
            <li>· Pass 1: agent reasons in agent-mode (SOUL.md, skills, memories)</li>
            <li>· Pass 2: function-calling inference fires real tools (Tavily, on-chain reads)</li>
            <li>· Returning sealed commit hash for your signature</li>
          </ul>
          <p className="text-[10px] text-muted-foreground">
            This usually takes 30–60 seconds.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function PreviewStep({
  prepared,
  predictionPct,
}: {
  prepared: PreparedCommit;
  predictionPct: number;
}) {
  const toolCount = prepared.toolCalls?.length ?? 0;
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-md border border-accent-life/30 bg-accent-life/[0.04] p-4">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-accent-life/90">
          <Target size={11} weight="bold" />
          Agent's prediction
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-display text-4xl font-light text-foreground tabular-nums">
            {predictionPct.toFixed(2)}%
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {prepared.prediction} bps
          </span>
        </div>
      </div>

      {prepared.openclawReasoning && (
        <div className="space-y-2 rounded-md border border-accent-lineage/30 bg-accent-lineage/[0.04] p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-accent-lineage/90">
            <span className="flex items-center gap-1.5">
              <Brain size={11} weight="bold" />
              Pass 1 · OpenClaw reasoning
            </span>
            <span className="font-mono normal-case tracking-normal text-accent-lineage/70">
              openclaw agent
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85">
            {prepared.openclawReasoning.length > 600
              ? `${prepared.openclawReasoning.slice(0, 600)}…`
              : prepared.openclawReasoning}
          </p>
        </div>
      )}

      {toolCount > 0 && (
        <div className="space-y-2 rounded-md border border-accent-life/30 bg-accent-life/[0.04] p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-accent-life/90">
            <span className="flex items-center gap-1.5">
              <Wrench size={11} weight="bold" />
              Pass 2 · {toolCount} tool call{toolCount === 1 ? "" : "s"}
            </span>
            {prepared.inferenceIterations && (
              <span className="font-mono normal-case tracking-normal text-accent-life/70">
                {prepared.inferenceIterations} turns
              </span>
            )}
          </div>
          <ol className="space-y-1.5 text-xs">
            {prepared.toolCalls?.slice(0, 3).map((c, i) => (
              <li
                key={i}
                className="rounded border border-white/5 bg-zinc-950/60 p-2"
              >
                <div className="flex items-center justify-between font-mono text-[10px] text-accent-life">
                  <span>
                    {c.ok ? "✓" : "✗"} {c.tool}
                  </span>
                  <span className="text-muted-foreground">{c.durationMs}ms</span>
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-foreground/85">
                  {c.summary}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {prepared.reasoningPreview && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-white/55">
            Reasoning preview
          </div>
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
            {prepared.reasoningPreview}
          </p>
        </div>
      )}

      <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-white/55">
          Sealed commit hash
        </div>
        <p className="break-all font-mono text-[10px] text-foreground/80">
          {prepared.commitHash}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Nonce is held by the daemon's commit-store and will be used to reveal
          after the commit deadline.
        </p>
      </div>
    </div>
  );
}

function SubmitStatusStep({
  phase,
  predictionPct,
  txHash,
}: {
  phase: Phase;
  predictionPct: number;
  txHash: `0x${string}` | undefined;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center gap-3 rounded-md border border-accent-life/30 bg-accent-life/[0.04] px-4 py-4">
        {phase !== "done" ? (
          <CircleNotch size={18} className="animate-spin text-accent-life" />
        ) : (
          <Sparkle size={18} weight="fill" className="text-accent-life" />
        )}
        <div className="flex-1">
          <div className="text-sm text-foreground">
            {phase === "signing" && "Confirm in your wallet…"}
            {phase === "confirming" && "Sealing on 0G mainnet…"}
            {phase === "done" && "Sealed. Daemon will reveal after the deadline."}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Committed prediction: {predictionPct.toFixed(2)}%
          </div>
        </div>
      </div>
      {txHash && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-white/55">
            Tx hash
          </div>
          <p className="break-all font-mono text-[10px] text-foreground/80">
            {txHash}
          </p>
        </div>
      )}
    </div>
  );
}

function DialogFooter({
  entryFee,
  phase,
  ownedAgentsCount,
  agentId,
  onRun,
  onSign,
  onRetry,
}: {
  entryFee: bigint;
  phase: Phase;
  ownedAgentsCount: number;
  agentId: bigint | undefined;
  onRun: () => void;
  onSign: () => void;
  onRetry: () => void;
}) {
  const feeLabel = `${formatEther(entryFee)} OG`;
  return (
    <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-5">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        Entry fee {feeLabel}
      </div>
      <div className="flex items-center gap-2">
        {(phase === "pick" || phase === "preparing") && (
          <button
            onClick={onRun}
            disabled={
              phase === "preparing" || ownedAgentsCount === 0 || agentId === undefined
            }
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "preparing" && (
              <CircleNotch size={12} className="animate-spin" />
            )}
            {phase === "preparing" ? "Running inference…" : "Run inference"}
            {phase !== "preparing" && <ArrowRight size={12} weight="bold" />}
          </button>
        )}
        {phase === "preview" && (
          <button
            onClick={onSign}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-opacity hover:opacity-90"
          >
            Sign & submit · {feeLabel}
            <ArrowRight size={12} weight="bold" />
          </button>
        )}
        {phase === "error" && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
