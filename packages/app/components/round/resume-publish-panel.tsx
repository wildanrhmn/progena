"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ArrowUpRight, CheckCircle, CircleNotch, Warning } from "@phosphor-icons/react";
import { keccak256, toBytes } from "viem";
import { Panel } from "@/components/ui/panel";
import { roundMetadataContract } from "@/lib/contracts";
import {
  clearPendingPublish,
  getPendingPublish,
} from "@/lib/pending-publish";
import { EXPLORER_URL } from "@/lib/chain";

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  roundId: bigint;
  expectedHash: `0x${string}`;
  onSuccess?: () => void;
};

export function ResumePublishPanel({
  roundId,
  expectedHash,
  onSuccess,
}: Props) {
  const [text, setText] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const pending = getPendingPublish(roundId);
    if (pending) setText(pending.text);
    setHydrated(true);
  }, [roundId]);

  const trimmed = text.trim();
  const computedHash = useMemo<`0x${string}` | undefined>(() => {
    if (trimmed.length === 0) return undefined;
    try {
      return keccak256(toBytes(trimmed));
    } catch {
      return undefined;
    }
  }, [trimmed]);
  const hashMatches =
    computedHash !== undefined &&
    computedHash.toLowerCase() === expectedHash.toLowerCase();

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (!isSuccess) return;
    clearPendingPublish(roundId);
    onSuccess?.();
  }, [isSuccess, roundId, onSuccess]);

  const submit = () => {
    if (trimmed.length < 8 || !hashMatches) return;
    writeContract({
      ...roundMetadataContract,
      functionName: "publishQuestion",
      args: [roundId, trimmed],
    });
  };

  const inFlight = isPending || confirming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Panel>
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <Warning
              size={20}
              weight="fill"
              className="mt-0.5 shrink-0 text-amber-300"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-xs uppercase tracking-[0.18em] text-amber-300/90">
                Round needs its question
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">
                This round was created but the question text never landed
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                It happens when the second transaction (publishQuestion) runs
                out of gas or never gets signed. The round can't resolve
                without its question — fill it in below and sign one more
                transaction to unstick it.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              disabled={inFlight}
              placeholder={
                hydrated
                  ? "Will the OG token close ≥ $2.00 USD on 2026-05-15 12:00 UTC?"
                  : "Loading saved draft…"
              }
              className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none disabled:opacity-60"
            />

            <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="uppercase tracking-wider text-zinc-500">
                  Required hash
                </span>
                <span className="break-all font-mono text-foreground/80">
                  {expectedHash}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="uppercase tracking-wider text-zinc-500">
                  Your text hashes to
                </span>
                <span className="break-all font-mono text-foreground/80">
                  {computedHash ?? "—"}
                </span>
              </div>
              {trimmed.length > 0 &&
                (hashMatches ? (
                  <div className="flex items-center gap-1.5 text-accent-life">
                    <CheckCircle size={12} weight="fill" />
                    Hash matches — safe to publish
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5 text-red-300">
                    <Warning size={12} weight="fill" className="mt-0.5 shrink-0" />
                    <span>
                      Hash mismatch. The contract requires the EXACT text that
                      was hashed when the round was created — every character,
                      including capitalization and punctuation. If you don't
                      have the original text saved, this round can't be
                      unstuck.
                    </span>
                  </div>
                ))}
            </div>

            {error && (
              <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {error.message}
              </p>
            )}

            {txHash && (
              <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Tx</span>
                <a
                  href={`${EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-foreground transition-colors hover:text-accent-life"
                >
                  {txHash.slice(0, 8)}…{txHash.slice(-6)}
                  <ArrowUpRight size={10} weight="bold" />
                </a>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Anyone can publish a question for a round that doesn't have
                one. Only one tx, low gas.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (isSuccess) reset();
                  submit();
                }}
                disabled={inFlight || trimmed.length < 8 || !hashMatches}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inFlight && <CircleNotch size={12} className="animate-spin" />}
                {isPending
                  ? "Confirm in wallet…"
                  : confirming
                    ? "Publishing…"
                    : isSuccess
                      ? "Published"
                      : "Publish question"}
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}
