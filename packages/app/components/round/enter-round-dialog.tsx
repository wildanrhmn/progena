"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { formatEther, type Address } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  CircleNotch,
  X,
} from "@phosphor-icons/react";
import { predictionRoundContract } from "@/lib/contracts";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";
import { EXPLORER_URL } from "@/lib/chain";

const EASE = [0.16, 1, 0.3, 1] as const;

const FRIENDLY_TOOL_NAMES: Record<string, string> = {
  fetch_token_price: "Price feed",
  web_search: "Web search",
  fetch_market_state: "Market state",
  read_on_chain: "On-chain data",
};

function friendlyToolName(name: string): string {
  return (
    FRIENDLY_TOOL_NAMES[name] ??
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
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
  | "details"
  | "signing"
  | "confirming"
  | "done"
  | "error";

const PREPARING_MESSAGES = [
  "Waking up your agent",
  "Reading personality + past lessons",
  "Checking live data",
  "Sealing the answer",
];

function cardBase(extra?: string): string {
  return [
    "relative w-full flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-2xl",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function GradientLine() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"
    />
  );
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

  const closeable =
    phase !== "preparing" && phase !== "signing" && phase !== "confirming";

  const close = () => {
    if (!closeable) return;
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
      await new Promise((r) => setTimeout(r, 1800));
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
  const selectedAgent = ownedAgents.find((a) => a.id === agentId);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-10"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <button
            onClick={close}
            disabled={!closeable}
            aria-label="Close"
            className="absolute right-4 top-4 z-[110] rounded-full border border-zinc-800/80 bg-zinc-950/90 p-1.5 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-30"
          >
            <X size={14} weight="bold" />
          </button>

          <div className="relative flex w-full justify-center">
            <AnimatePresence mode="wait">
              {phase === "pick" && (
                <PickCard
                  key="pick"
                  question={question}
                  roundId={roundId}
                  agents={ownedAgents}
                  selectedId={agentId}
                  onSelect={setAgentId}
                  error={error}
                  entryFee={entryFee}
                  onRun={runInference}
                />
              )}
              {phase === "preparing" && (
                <PreparingCard key="preparing" agent={selectedAgent} />
              )}
              {phase === "preview" && prepared && (
                <PreviewCard
                  key="preview"
                  prepared={prepared}
                  predictionPct={predictionPct}
                  agent={selectedAgent}
                  entryFee={entryFee}
                  onSign={sign}
                  onShowDetails={() => setPhase("details")}
                  question={question}
                />
              )}
              {phase === "details" && prepared && (
                <DetailsCard
                  key="details"
                  prepared={prepared}
                  predictionPct={predictionPct}
                  onBack={() => setPhase("preview")}
                />
              )}
              {(phase === "signing" ||
                phase === "confirming" ||
                phase === "done") &&
                prepared && (
                  <SubmitCard
                    key="submit"
                    phase={phase}
                    predictionPct={predictionPct}
                    txHash={txHash}
                  />
                )}
              {phase === "error" && (
                <ErrorCard
                  key="error"
                  error={error}
                  onRetry={() => setPhase("pick")}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

const cardEnter = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.97 },
  transition: { duration: 0.32, ease: EASE },
};

function PickCard({
  question,
  roundId,
  agents,
  selectedId,
  onSelect,
  error,
  entryFee,
  onRun,
}: {
  question: string | undefined;
  roundId: bigint;
  agents: AgentRow[];
  selectedId: bigint | undefined;
  onSelect: (id: bigint) => void;
  error?: string;
  entryFee: bigint;
  onRun: () => void;
}) {
  const canRun = selectedId !== undefined && agents.length > 0;
  return (
    <motion.div {...cardEnter} className={cardBase("max-w-md")}>
      <GradientLine />
      <div className="px-6 pb-3 pt-6">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Round #{roundId.toString()}
        </div>
        <h3 className="mt-1 text-base font-medium text-zinc-100">
          Send an agent in
        </h3>
        {question && (
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
            {question}
          </p>
        )}
      </div>

      <div className="space-y-2 px-6 pb-4">
        {agents.length === 0 ? (
          <p className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
            You don't own any agents yet.
          </p>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              {agents.length} agent{agents.length === 1 ? "" : "s"}
            </div>
            <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
              {agents.map((a) => {
                const checked = selectedId === a.id;
                return (
                  <button
                    key={a.id.toString()}
                    type="button"
                    onClick={() => onSelect(a.id)}
                    className={
                      checked
                        ? "flex w-full items-center justify-between rounded-md border border-accent-life/50 bg-accent-life/[0.06] px-3 py-2 text-left"
                        : "flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left transition-colors hover:border-zinc-600"
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground">
                        {displayNameOf(a)}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">
                        Gen {a.generation} · #{a.id.toString()}
                      </div>
                    </div>
                    <div
                      className={
                        checked
                          ? "h-2 w-2 rounded-full bg-accent-life"
                          : "h-2 w-2 rounded-full border border-zinc-600"
                      }
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800/80 px-6 py-4">
        <span className="text-xs text-zinc-500">
          Entry {formatEther(entryFee)} OG
        </span>
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Make prediction
          <ArrowRight size={14} weight="bold" />
        </button>
      </div>
    </motion.div>
  );
}

function PreparingCard({ agent }: { agent?: AgentRow }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => (i + 1) % PREPARING_MESSAGES.length),
      1800
    );
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div
      {...cardEnter}
      className={cardBase("max-w-sm items-center px-8 py-10")}
    >
      <GradientLine />
      <CircleNotch size={32} className="animate-spin text-zinc-400" />
      <div className="mt-4 text-center">
        <div className="text-sm text-foreground">
          {agent ? `${displayNameOf(agent)} is thinking` : "Thinking"}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mt-1 text-xs text-muted-foreground"
          >
            {PREPARING_MESSAGES[idx]}…
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-xs text-zinc-600">~30–60 seconds</p>
    </motion.div>
  );
}

function PreviewCard({
  prepared,
  predictionPct,
  agent,
  entryFee,
  onSign,
  onShowDetails,
  question,
}: {
  prepared: PreparedCommit;
  predictionPct: number;
  agent?: AgentRow;
  entryFee: bigint;
  onSign: () => void;
  onShowDetails: () => void;
  question: string | undefined;
}) {
  const toolCount = prepared.toolCalls?.length ?? 0;
  const hasDetails = !!prepared.openclawReasoning || toolCount > 0;
  return (
    <motion.div {...cardEnter} className={cardBase("max-w-md")}>
      <GradientLine />
      <div className="px-6 pb-4 pt-6">
        {question && (
          <p className="line-clamp-2 text-center text-sm leading-snug text-muted-foreground">
            {question}
          </p>
        )}
        <div className="mt-5 text-center">
          <div className="text-xs uppercase tracking-wider text-accent-life/80">
            {agent ? displayNameOf(agent) : "Agent"} predicts
          </div>
          <div className="mt-1 font-display text-6xl font-light tabular-nums text-accent-life">
            {predictionPct.toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            confidence the answer is YES
          </div>
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={onShowDetails}
            className="mt-5 flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-foreground"
          >
            <span className="uppercase tracking-wider text-zinc-500">
              How it decided
            </span>
            <ArrowRight size={12} weight="bold" className="text-zinc-500" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800/80 px-6 py-4">
        <span className="text-xs text-zinc-500">
          Entry {formatEther(entryFee)} OG
        </span>
        <button
          type="button"
          onClick={onSign}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500"
        >
          Sign · {formatEther(entryFee)} OG
          <ArrowRight size={14} weight="bold" />
        </button>
      </div>
    </motion.div>
  );
}

function DetailsCard({
  prepared,
  predictionPct,
  onBack,
}: {
  prepared: PreparedCommit;
  predictionPct: number;
  onBack: () => void;
}) {
  const toolCount = prepared.toolCalls?.length ?? 0;
  return (
    <motion.div
      {...cardEnter}
      className={cardBase("max-w-2xl max-h-[calc(100vh-4rem)]")}
    >
      <GradientLine />
      <div className="flex items-center justify-between px-6 pb-3 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={11} weight="bold" />
          Back to prediction
        </button>
        <div className="flex items-baseline gap-2 text-xs">
          <span className="uppercase tracking-wider text-accent-life/80">
            Predicted
          </span>
          <span className="font-mono text-accent-life">
            {predictionPct.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        {prepared.openclawReasoning && (
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-accent-life/80">
              Reasoning
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
              {prepared.openclawReasoning}
            </p>
          </div>
        )}
        {toolCount > 0 && prepared.toolCalls && (
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-accent-life/80">
              Sources checked
            </div>
            <ul className="space-y-2">
              {prepared.toolCalls.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="text-xs uppercase tracking-wider text-zinc-500">
                    {friendlyToolName(c.tool)}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                    {c.summary}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SubmitCard({
  phase,
  predictionPct,
  txHash,
}: {
  phase: Phase;
  predictionPct: number;
  txHash: `0x${string}` | undefined;
}) {
  const done = phase === "done";
  return (
    <motion.div
      {...cardEnter}
      className={cardBase("max-w-sm items-center px-8 py-10")}
    >
      <GradientLine />
      {done ? (
        <CheckCircle size={36} weight="fill" className="text-accent-life" />
      ) : (
        <CircleNotch size={32} className="animate-spin text-zinc-400" />
      )}
      <div className="mt-4 text-center">
        <div className="text-sm text-foreground">
          {phase === "signing" && "Confirm in your wallet"}
          {phase === "confirming" && "Sealing on-chain"}
          {done && "Sealed"}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {predictionPct.toFixed(2)}% committed
        </div>
      </div>
      {txHash && (
        <a
          href={`${EXPLORER_URL}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-foreground"
        >
          {txHash.slice(0, 8)}…{txHash.slice(-6)}
          <ArrowUpRight size={11} weight="bold" />
        </a>
      )}
    </motion.div>
  );
}

function ErrorCard({
  error,
  onRetry,
}: {
  error?: string;
  onRetry: () => void;
}) {
  return (
    <motion.div {...cardEnter} className={cardBase("max-w-sm p-6")}>
      <GradientLine />
      <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
        {error ?? "Something went wrong."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 self-end rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500"
      >
        Try again
      </button>
    </motion.div>
  );
}
