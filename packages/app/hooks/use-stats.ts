"use client";

import { useReadContracts } from "wagmi";
import {
  agentGenomeContract,
  predictionRoundContract,
} from "@/lib/contracts";

export type ChainStats = {
  totalMinted: bigint;
  nextRoundId: bigint;
  roundsCreated: bigint;
};

export function useChainStats() {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...agentGenomeContract, functionName: "totalMinted" } as const,
      { ...predictionRoundContract, functionName: "nextRoundId" } as const,
    ],
    allowFailure: true,
    query: { staleTime: 30_000 },
  });

  const totalMinted =
    data?.[0]?.status === "success" ? (data[0].result as bigint) : 0n;
  const nextRoundId =
    data?.[1]?.status === "success" ? (data[1].result as bigint) : 1n;
  const roundsCreated = nextRoundId > 0n ? nextRoundId - 1n : 0n;

  return {
    stats: { totalMinted, nextRoundId, roundsCreated } satisfies ChainStats,
    isLoading,
    error,
  };
}
