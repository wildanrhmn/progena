"use client";

import { useReadContract } from "wagmi";
import { roundMetadataContract } from "@/lib/contracts";

export function useRoundQuestion(roundId: bigint | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...roundMetadataContract,
    functionName: "questionOf",
    args: roundId !== undefined ? [roundId] : undefined,
    query: {
      enabled: roundId !== undefined,
      staleTime: 4_000,
      refetchInterval: (query) => {
        const text = (query.state.data as string | undefined) ?? "";
        return text.length > 0 ? false : 4_000;
      },
    },
  });
  const text = (data as string | undefined) ?? "";
  return {
    text: text.length > 0 ? text : undefined,
    isLoading,
    error,
    refetch,
  };
}
