"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CircleNotch, PencilSimple, X } from "@phosphor-icons/react";
import { agentRegistryContract } from "@/lib/contracts";

const NAME_RE = /^[A-Za-z0-9 _-]{2,32}$/;

type Props = {
  agentId: bigint;
  onSuccess?: () => void;
};

export function SetNameButton({ agentId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isSuccess) {
    onSuccess?.();
    return null;
  }

  const submit = () => {
    if (!NAME_RE.test(name)) {
      setValidation("2–32 chars · letters, numbers, spaces, dashes, underscores");
      return;
    }
    setValidation(null);
    writeContract({
      ...agentRegistryContract,
      functionName: "setName",
      args: [agentId, name],
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
      >
        <PencilSimple size={14} weight="bold" />
        Claim name
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => {
                    if (!isPending && !confirming) {
                      setOpen(false);
                      reset();
                    }
                  }}
                  aria-label="Close"
                />
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.97 }}
                  transition={{
                    duration: 0.32,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-2xl"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"
                  />
            <button
              onClick={() => {
                if (!isPending && !confirming) {
                  setOpen(false);
                  reset();
                }
              }}
              className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-100"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>

            <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Agent #{agentId.toString()}
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              Claim a name
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Names are recorded on-chain in the AgentRegistry. Each token can
              claim exactly one name, and each name can be claimed by exactly
              one token. Choose carefully — this is permanent.
            </p>

            <div className="mt-5">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-zinc-500">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setValidation(null);
                }}
                disabled={isPending || confirming}
                placeholder="e.g. Cyber-Sage"
                maxLength={32}
                autoFocus
                className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/60 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              {validation ? (
                <p className="mt-2 text-xs text-red-400">{validation}</p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">
                  {name.length}/32 · letters, numbers, spaces, dashes,
                  underscores
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  if (!isPending && !confirming) {
                    setOpen(false);
                    reset();
                  }
                }}
                disabled={isPending || confirming}
                className="rounded-full px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending || confirming || name.length < 2}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {(isPending || confirming) && (
                  <CircleNotch size={14} weight="bold" className="animate-spin" />
                )}
                {isPending
                  ? "Confirm in wallet…"
                  : confirming
                    ? "Recording…"
                    : "Claim on-chain"}
              </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
