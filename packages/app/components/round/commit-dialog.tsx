"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { formatEther } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  CircleNotch,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { predictionRoundContract } from "@/lib/contracts";
import { buildCommitHash, randomNonce, saveCommit } from "@/lib/commit";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";

type Props = {
  roundId: bigint;
  entryFee: bigint;
  ownedAgents: AgentRow[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function CommitDialog({
  roundId,
  entryFee,
  ownedAgents,
  open,
  onClose,
  onSuccess,
}: Props) {
  const [agentId, setAgentId] = useState<bigint | undefined>(
    ownedAgents[0]?.id
  );
  const [predictionPct, setPredictionPct] = useState(65);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isSuccess && open) {
    onSuccess?.();
    onClose();
    reset();
  }

  const submit = () => {
    if (agentId === undefined) {
      setError("Pick an agent");
      return;
    }
    if (predictionPct < 0 || predictionPct > 100) {
      setError("Prediction must be 0–100%");
      return;
    }
    setError(null);
    const prediction = Math.round(predictionPct * 100); // → 0..10000
    const nonce = randomNonce();
    const commitHash = buildCommitHash(roundId, agentId, prediction, nonce);

    saveCommit(roundId, agentId, {
      prediction,
      nonce,
      commitHash,
      savedAt: Date.now(),
    });

    writeContract({
      ...predictionRoundContract,
      functionName: "commitPrediction",
      args: [roundId, agentId, commitHash],
      value: entryFee,
    });
  };

  const close = () => {
    if (isPending || confirming) return;
    onClose();
    reset();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-2xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"
            />

            <button
              onClick={close}
              className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-100"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>

            <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Round #{roundId.toString()}
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              Commit a prediction
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Sealed commit-reveal. We hash your prediction + a random nonce
              and save the nonce locally so you can reveal after the deadline.
              Entry fee:{" "}
              <span className="font-mono text-zinc-100">
                {formatEther(entryFee)} OG
              </span>
              .
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-wider text-zinc-500">
                  Agent
                </label>
                {ownedAgents.length === 0 ? (
                  <p className="rounded-md border border-amber-700/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-200">
                    You don't own any agents. Browse or breed one first.
                  </p>
                ) : (
                  <select
                    value={agentId !== undefined ? agentId.toString() : ""}
                    onChange={(e) => setAgentId(BigInt(e.target.value))}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 focus:border-emerald-600/60 focus:outline-none"
                  >
                    {ownedAgents.map((a) => (
                      <option key={a.id.toString()} value={a.id.toString()}>
                        {displayNameOf(a)} · Gen {a.generation}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">
                  <span>Prediction</span>
                  <span className="font-mono text-zinc-300">
                    {predictionPct.toFixed(0)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={predictionPct}
                  onChange={(e) => setPredictionPct(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <p className="mt-2 text-[11px] text-zinc-500">
                  Probability the answer is YES. Stored on-chain as basis
                  points (1% = 100).
                </p>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                <Sparkle size={11} weight="bold" className="mr-1 inline" />
                Will pay {formatEther(entryFee)} OG
              </div>
              <button
                onClick={submit}
                disabled={
                  isPending ||
                  confirming ||
                  ownedAgents.length === 0 ||
                  agentId === undefined
                }
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {(isPending || confirming) && (
                  <CircleNotch size={14} className="animate-spin" />
                )}
                {isPending
                  ? "Confirm in wallet…"
                  : confirming
                    ? "Sealing on-chain…"
                    : "Commit"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
