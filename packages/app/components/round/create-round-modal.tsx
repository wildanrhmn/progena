"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { parseEther, type Address } from "viem";
import {
  useAccount,
  useBalance,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CircleNotch, X } from "@phosphor-icons/react";
import {
  predictionRoundContract,
  roundMetadataContract,
} from "@/lib/contracts";
import { questionHashOf } from "@/lib/round-questions";
import { useNextRoundId } from "@/hooks/use-rounds";
import { savePendingPublish, clearPendingPublish } from "@/lib/pending-publish";

const GAS_BUFFER_OG = 0.005;

function toUnix(local: string): bigint {
  return BigInt(Math.floor(new Date(local).getTime() / 1000));
}

function nowPlus(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function CreateRoundModal({ open, onClose, onSuccess }: Props) {
  const router = useRouter();
  const { data: nextRaw, refetch: refetchNext } = useNextRoundId();
  const { address } = useAccount();
  const { data: balance } = useBalance({
    address: address as Address | undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const [question, setQuestion] = useState("");
  const [commitAt, setCommitAt] = useState(nowPlus(30));
  const [revealAt, setRevealAt] = useState(nowPlus(60));
  const [entryFee, setEntryFee] = useState("0.01");
  const [error, setError] = useState<string | null>(null);
  const [newRoundId, setNewRoundId] = useState<bigint | undefined>();

  const {
    writeContract: writeCreate,
    data: createTx,
    isPending: createPending,
    reset: resetCreate,
  } = useWriteContract();
  const { isLoading: createConfirming, isSuccess: createSuccess } =
    useWaitForTransactionReceipt({ hash: createTx });

  const {
    writeContract: writePublish,
    data: publishTx,
    isPending: publishPending,
    reset: resetPublish,
  } = useWriteContract();
  const { isLoading: publishConfirming, isSuccess: publishSuccess } =
    useWaitForTransactionReceipt({ hash: publishTx });

  useEffect(() => {
    if (!createSuccess || newRoundId !== undefined) return;
    refetchNext().then(({ data }) => {
      if (data) {
        const id = BigInt(data) - 1n;
        const trimmed = question.trim();
        setNewRoundId(id);
        savePendingPublish(id, trimmed);
        writePublish({
          ...roundMetadataContract,
          functionName: "publishQuestion",
          args: [id, trimmed],
        });
      }
    });
  }, [createSuccess, newRoundId, refetchNext, writePublish, question]);

  useEffect(() => {
    if (!publishSuccess || newRoundId === undefined) return;
    clearPendingPublish(newRoundId);
    onSuccess?.();
    const id = newRoundId.toString();
    const t = setTimeout(() => {
      router.push(`/rounds/${id}`);
      onClose();
      resetCreate();
      resetPublish();
      setNewRoundId(undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [publishSuccess, newRoundId, router, onClose, onSuccess, resetCreate, resetPublish]);

  const inFlight =
    createPending || createConfirming || publishPending || publishConfirming;

  const parsedEntryFee = useMemo(() => {
    try {
      return parseEther(entryFee || "0");
    } catch {
      return undefined;
    }
  }, [entryFee]);

  const gasBufferWei = parseEther(GAS_BUFFER_OG.toString());
  const requiredWei =
    parsedEntryFee !== undefined ? parsedEntryFee + gasBufferWei : undefined;
  const insufficient =
    !!balance &&
    requiredWei !== undefined &&
    balance.value < requiredWei;

  const close = () => {
    if (inFlight) return;
    onClose();
    resetCreate();
    resetPublish();
    setNewRoundId(undefined);
    setError(null);
  };

  const submit = () => {
    setError(null);
    const trimmed = question.trim();
    if (trimmed.length < 8) {
      setError("Question must be at least 8 characters");
      return;
    }
    let commitDeadline: bigint;
    let revealDeadline: bigint;
    let feeWei: bigint;
    try {
      commitDeadline = toUnix(commitAt);
      revealDeadline = toUnix(revealAt);
      feeWei = parseEther(entryFee || "0");
    } catch {
      setError("Invalid datetime or fee");
      return;
    }
    if (commitDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      setError("Commit deadline must be in the future");
      return;
    }
    if (revealDeadline <= commitDeadline) {
      setError("Reveal deadline must be after commit deadline");
      return;
    }
    const hash = questionHashOf(trimmed);
    writeCreate({
      ...predictionRoundContract,
      functionName: "createRound",
      args: [hash, commitDeadline, revealDeadline, feeWei],
    });
  };

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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[calc(100vh-5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-2xl"
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
              Operator action
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              Create a round
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Opens a sealed commit-reveal market. Agents commit a hashed
              prediction by the commit deadline, reveal after, and the oracle
              scores them at resolve.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Question">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                  placeholder="Will the OG token close ≥ $2.00 USD on 2026-05-15 12:00 UTC?"
                  className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/60 focus:outline-none"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Commit deadline">
                  <input
                    type="datetime-local"
                    value={commitAt}
                    onChange={(e) => setCommitAt(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 focus:border-emerald-600/60 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </Field>
                <Field label="Reveal deadline">
                  <input
                    type="datetime-local"
                    value={revealAt}
                    onChange={(e) => setRevealAt(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 focus:border-emerald-600/60 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </Field>
              </div>

              <Field label="Entry fee (OG)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  placeholder="0.01"
                  className="w-40 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 focus:border-emerald-600/60 focus:outline-none"
                />
              </Field>

              {error && <p className="text-xs text-red-400">{error}</p>}

              {insufficient && (
                <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  Wallet balance is low for the entry fee + 2-tx gas. Top up if
                  the tx fails.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-5">
              <button
                onClick={close}
                disabled={inFlight}
                className="rounded-full px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={inFlight || insufficient}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {inFlight && <CircleNotch size={14} className="animate-spin" />}
                {createPending
                  ? "Confirm create in wallet…"
                  : createConfirming
                    ? "Creating round on-chain…"
                    : publishPending
                      ? "Confirm publish in wallet…"
                      : publishConfirming
                        ? "Publishing question text…"
                        : insufficient
                          ? "Insufficient OG"
                          : "Create round"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}
