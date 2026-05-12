"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import {
  predictionRoundContract,
  roundMetadataContract,
} from "@/lib/contracts";

export type RoundStatus = "NonExistent" | "Open" | "RevealPhase" | "Closed" | "Resolved";
const STATUS_LABELS: RoundStatus[] = [
  "NonExistent",
  "Open",
  "RevealPhase",
  "Closed",
  "Resolved",
];

export type RoundData = {
  id: bigint;
  questionHash: `0x${string}`;
  commitDeadline: bigint;
  revealDeadline: bigint;
  outcome: number;
  resolved: boolean;
  totalCommitted: bigint;
  totalRevealed: bigint;
  entryFee: bigint;
  totalPool: bigint;
  status: RoundStatus;
};

export type CommitmentData = {
  commitHash: `0x${string}`;
  prediction: number;
  revealed: boolean;
  exists: boolean;
};

export function useNextRoundId() {
  return useReadContract({
    ...predictionRoundContract,
    functionName: "nextRoundId",
    query: { staleTime: 15_000 },
  });
}

export function useRound(id: bigint | undefined) {
  const enabled = id !== undefined && id > 0n;
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: enabled
      ? [
          { ...predictionRoundContract, functionName: "roundOf", args: [id!] } as const,
          { ...predictionRoundContract, functionName: "statusOf", args: [id!] } as const,
        ]
      : [],
    allowFailure: true,
    query: { enabled, staleTime: 4_000, refetchInterval: 5_000 },
  });

  const round = useMemo<RoundData | undefined>(() => {
    if (!data || data[0]?.status !== "success" || data[1]?.status !== "success" || !id)
      return undefined;
    const tuple = data[0].result as {
      questionHash: `0x${string}`;
      commitDeadline: bigint;
      revealDeadline: bigint;
      outcome: number;
      resolved: boolean;
      totalCommitted: bigint;
      totalRevealed: bigint;
      entryFee: bigint;
      totalPool: bigint;
    };
    const statusIdx = Number(data[1].result as number);
    return {
      id,
      ...tuple,
      status: STATUS_LABELS[statusIdx] ?? "NonExistent",
    };
  }, [data, id]);

  return { round, isLoading, error, refetch };
}

export function useRoundsList(limit = 20) {
  const { data: nextRaw } = useNextRoundId();
  const total = nextRaw ? Number(nextRaw) - 1 : 0;

  const ids = useMemo(() => {
    if (total <= 0) return [];
    const take = Math.min(total, limit);
    return Array.from({ length: take }, (_, i) => BigInt(total - i));
  }, [total, limit]);

  const calls = useMemo(
    () =>
      ids.flatMap((id) => [
        { ...predictionRoundContract, functionName: "roundOf", args: [id] } as const,
        { ...predictionRoundContract, functionName: "statusOf", args: [id] } as const,
        { ...roundMetadataContract, functionName: "questionOf", args: [id] } as const,
      ]),
    [ids]
  );

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: calls,
    allowFailure: true,
    query: { enabled: ids.length > 0, staleTime: 10_000 },
  });

  const rounds = useMemo<RoundData[]>(() => {
    if (!data) return [];
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const out: RoundData[] = [];
    for (let i = 0; i < ids.length; i++) {
      const roundRes = data[i * 3];
      const statusRes = data[i * 3 + 1];
      const questionRes = data[i * 3 + 2];
      if (roundRes?.status !== "success" || statusRes?.status !== "success") continue;
      const tuple = roundRes.result as Omit<RoundData, "id" | "status">;
      const statusIdx = Number(statusRes.result as number);
      const questionText =
        questionRes?.status === "success" ? (questionRes.result as string) : "";
      const hasQuestion = typeof questionText === "string" && questionText.length > 0;
      const isDead =
        !tuple.resolved && tuple.revealDeadline < nowSec && !hasQuestion;
      if (isDead) continue;
      out.push({
        id: ids[i]!,
        ...tuple,
        status: STATUS_LABELS[statusIdx] ?? "NonExistent",
      });
    }
    return out;
  }, [data, ids]);

  return { rounds, total, isLoading, error, refetch };
}

export function useCommitment(
  roundId: bigint | undefined,
  agentId: bigint | undefined
) {
  const enabled = roundId !== undefined && agentId !== undefined;
  return useReadContract({
    ...predictionRoundContract,
    functionName: "commitmentOf",
    args: enabled ? [roundId!, agentId!] : undefined,
    query: { enabled, staleTime: 5_000 },
  });
}

export function useRoundAgents(roundId: bigint | undefined) {
  return useReadContract({
    ...predictionRoundContract,
    functionName: "agentsOf",
    args: roundId !== undefined ? [roundId] : undefined,
    query: {
      enabled: roundId !== undefined,
      staleTime: 4_000,
      refetchInterval: 5_000,
    },
  });
}

export function useRoundOwner() {
  return useReadContract({
    ...predictionRoundContract,
    functionName: "owner",
    query: { staleTime: 60_000 },
  });
}

export function usePendingPayout(viewer: Address | undefined) {
  return useReadContract({
    ...predictionRoundContract,
    functionName: "pendingPayoutOf",
    args: viewer ? [viewer] : undefined,
    query: { enabled: !!viewer, staleTime: 10_000 },
  });
}
