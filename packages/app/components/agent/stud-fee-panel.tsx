"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CircleNotch, Coin, PencilSimple } from "@phosphor-icons/react";
import { breedingContract } from "@/lib/contracts";
import { useStudFee } from "@/hooks/use-stud-fee";

type Props = {
  agentId: bigint;
  isOwner: boolean;
};

export function StudFeePanel({ agentId, isOwner }: Props) {
  const { data: feeRaw, refetch } = useStudFee(agentId);
  const fee = (feeRaw as bigint | undefined) ?? 0n;
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isSuccess && editing) {
    refetch();
    setEditing(false);
    setInput("");
    reset();
  }

  const submit = () => {
    let value: bigint;
    try {
      value = parseEther(input || "0");
    } catch {
      setError("Invalid amount");
      return;
    }
    setError(null);
    writeContract({
      ...breedingContract,
      functionName: "setStudFee",
      args: [agentId, value],
    });
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55">
          <Coin size={11} weight="bold" />
          Stud fee
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              disabled={isPending || confirming}
              placeholder="0.0"
              className="w-32 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/60 focus:outline-none"
            />
            <span className="text-sm text-muted-foreground">OG</span>
          </div>
        ) : (
          <div className="font-display text-2xl font-light text-foreground">
            {formatEther(fee)}{" "}
            <span className="text-base text-muted-foreground">OG</span>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        {!editing && fee === 0n && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Free for everyone — including non-owners
          </p>
        )}
      </div>

      {isOwner && !editing && (
        <button
          onClick={() => {
            setInput(formatEther(fee));
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
        >
          <PencilSimple size={11} weight="bold" />
          Set
        </button>
      )}
      {isOwner && editing && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditing(false);
              setInput("");
              setError(null);
              reset();
            }}
            disabled={isPending || confirming}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isPending || confirming}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {(isPending || confirming) && (
              <CircleNotch size={10} className="animate-spin" />
            )}
            Save
          </button>
        </div>
      )}
    </div>
  );
}
