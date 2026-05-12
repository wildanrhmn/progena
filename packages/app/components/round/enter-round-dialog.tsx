"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { formatEther, type Address } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  ArrowRight,
  ArrowUpRight,
  CircleNotch,
  Lightning,
  Sparkle,
  Target,
  X,
} from "@phosphor-icons/react";
import { predictionRoundContract } from "@/lib/contracts";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";
import { ExpandableList, ExpandableText } from "@/components/ui/expandable";
import { EXPLORER_URL } from "@/lib/chain";

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

const FRIENDLY_TOOL_NAMES: Record<string, string> = {
  fetch_token_price: "Price feed",
  web_search: "Web search",
  fetch_market_state: "Market state",
  read_on_chain: "On-chain data",
};

function friendlyToolName(name: string): string {
  return (
    FRIENDLY_TOOL_NAMES[name] ??
    name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

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

            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent-life/80">
              <Lightning size={12} weight="fill" />
              Round #{roundId.toString()} · enter
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              Send an agent into this round
            </h3>
            {question && (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
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
        <label className="mb-2 block text-xs uppercase tracking-wider text-zinc-400">
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
                    <div className="font-mono text-xs text-muted-foreground">
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
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent-lineage">
            <CircleNotch size={12} className="animate-spin" />
            Your agent is making its prediction
          </div>
          <ul className="space-y-1 text-sm text-foreground/85">
            <li>· Waking up your agent</li>
            <li>· Reasoning from its personality and past lessons</li>
            <li>· Checking live data — prices, news, on-chain state</li>
            <li>· Sealing the answer in a hash for you to sign</li>
          </ul>
          <p className="text-xs text-muted-foreground">
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
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-accent-life/90">
          <Target size={12} weight="bold" />
          Agent's prediction
        </div>
        <div className="mt-1.5 flex items-baseline gap-3">
          <span className="font-display text-4xl font-light text-foreground tabular-nums">
            {predictionPct.toFixed(2)}%
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {prepared.prediction} bps
          </span>
        </div>
      </div>

      {prepared.openclawReasoning && (
        <ExpandableText
          tone="lineage"
          label="How your agent thought about it"
          text={prepared.openclawReasoning}
          previewLines={3}
          footnote="The full reasoning lands in the memory shard after the round resolves."
        />
      )}

      {toolCount > 0 && prepared.toolCalls && (
        <ExpandableList
          tone="life"
          heading="What your agent checked"
          items={prepared.toolCalls.map((c, i) => ({
            key: String(i),
            label: friendlyToolName(c.tool),
            body: c.summary,
          }))}
          initial={2}
        />
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
        <div className="mb-1.5 text-xs uppercase tracking-wider text-white/65">
          Sealed commit hash
        </div>
        <p className="break-all font-mono text-xs text-foreground/80">
          {prepared.commitHash}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your prediction is hidden inside this hash. Progena will reveal it
          automatically after entries close, so you don't have to come back.
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
            {phase === "done" && "Sealed. We'll reveal your prediction automatically after entries close."}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Committed prediction: {predictionPct.toFixed(2)}%
          </div>
        </div>
      </div>
      {txHash && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs uppercase tracking-wider text-white/65">
            <span>Transaction</span>
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 normal-case tracking-normal text-accent-life hover:text-accent-life/80"
            >
              View on explorer
              <ArrowUpRight size={11} weight="bold" />
            </a>
          </div>
          <p className="break-all font-mono text-xs text-foreground/80">
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
      <div className="text-xs uppercase tracking-wider text-zinc-400">
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
            {phase === "preparing" ? "Thinking…" : "Make a prediction"}
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
