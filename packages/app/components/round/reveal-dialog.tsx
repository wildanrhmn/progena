"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CircleNotch, EyeSlash, X } from "@phosphor-icons/react";
import { predictionRoundContract } from "@/lib/contracts";
import { clearCommit, loadCommit } from "@/lib/commit";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";

type Props = {
  roundId: bigint;
  agent: AgentRow;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function RevealDialog({ roundId, agent, open, onClose, onSuccess }: Props) {
  const saved = loadCommit(roundId, agent.id);
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isSuccess && open) {
    clearCommit(roundId, agent.id);
    onSuccess?.();
    onClose();
    reset();
  }

  const submit = () => {
    if (!saved) return;
    writeContract({
      ...predictionRoundContract,
      functionName: "revealPrediction",
      args: [roundId, agent.id, saved.prediction, saved.nonce],
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
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
            />

            <button
              onClick={close}
              className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-100"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>

            <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Round #{roundId.toString()} · {displayNameOf(agent)}
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              Reveal prediction
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Surfaces the prediction + nonce you committed earlier so the
              contract can verify the hash.
            </p>

            {!saved ? (
              <div className="mt-5 rounded-md border border-amber-700/40 bg-amber-900/10 p-3 text-sm text-amber-200">
                <EyeSlash size={14} weight="bold" className="mr-1 inline" />
                No saved commit found on this browser. If you committed from a
                different device, reveal will fail unless you have the
                original prediction + nonce.
              </div>
            ) : (
              <dl className="mt-5 grid gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/40 p-4 text-xs">
                <Row label="Prediction" value={`${(saved.prediction / 100).toFixed(2)}%`} />
                <Row label="Nonce" value={saved.nonce} mono />
                <Row label="Hash" value={saved.commitHash} mono />
              </dl>
            )}

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-5">
              <button
                onClick={close}
                disabled={isPending || confirming}
                className="rounded-full px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!saved || isPending || confirming}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-bold text-zinc-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {(isPending || confirming) && (
                  <CircleNotch size={14} className="animate-spin" />
                )}
                {isPending
                  ? "Confirm in wallet…"
                  : confirming
                    ? "Revealing…"
                    : "Reveal on-chain"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-zinc-200 ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
