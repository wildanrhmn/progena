"use client";

import { formatEther, type Address } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { motion } from "framer-motion";
import { CircleNotch, Coin } from "@phosphor-icons/react";
import { Panel } from "@/components/ui/panel";
import { predictionRoundContract } from "@/lib/contracts";
import { usePendingPayout } from "@/hooks/use-rounds";

export function WithdrawWidget({ viewer }: { viewer: Address | undefined }) {
  const { data: pendingRaw, refetch } = usePendingPayout(viewer);
  const pending = (pendingRaw as bigint | undefined) ?? 0n;

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isSuccess) {
    refetch();
    reset();
  }

  if (!viewer || pending === 0n) return null;

  const submit = () => {
    writeContract({
      ...predictionRoundContract,
      functionName: "withdrawPayout",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      <Panel>
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-life/15 text-accent-life">
              <Coin size={18} weight="bold" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Pending payout
              </div>
              <div className="font-display text-2xl font-light tracking-tight text-foreground">
                {formatEther(pending)}{" "}
                <span className="text-base text-muted-foreground">OG</span>
              </div>
            </div>
          </div>
          <button
            onClick={submit}
            disabled={isPending || confirming}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {(isPending || confirming) && (
              <CircleNotch size={14} className="animate-spin" />
            )}
            {isPending
              ? "Confirm in wallet…"
              : confirming
                ? "Withdrawing…"
                : "Withdraw"}
          </button>
        </div>
      </Panel>
    </motion.div>
  );
}
