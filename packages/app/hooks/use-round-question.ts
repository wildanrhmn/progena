"use client";

import { useReadContract } from "wagmi";
import { roundMetadataContract } from "@/lib/contracts";

export function useRoundQuestion(roundId: bigint | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...roundMetadataContract,
    functionName: "questionOf",
    args: roundId !== undefined ? [roundId] : undefined,
    query: { enabled: roundId !== undefined, staleTime: 60_000 },
  });
  const text = (data as string | undefined) ?? "";
  return {
    text: text.length > 0 ? text : undefined,
    isLoading,
    error,
    refetch,
  };
}
