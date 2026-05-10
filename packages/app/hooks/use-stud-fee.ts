"use client";

import { useReadContract } from "wagmi";
import { breedingContract } from "@/lib/contracts";

export function useStudFee(tokenId: bigint | undefined) {
  return useReadContract({
    ...breedingContract,
    functionName: "studFeeOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined, staleTime: 30_000 },
  });
}
