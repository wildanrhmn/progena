"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { breedingContract } from "@/lib/contracts";

export function useBreedingFee(
  breeder: Address | undefined,
  parentA: bigint | undefined,
  parentB: bigint | undefined
) {
  const enabled =
    !!breeder && parentA !== undefined && parentB !== undefined && parentA !== parentB;
  return useReadContract({
    ...breedingContract,
    functionName: "quoteBreedingFee",
    args: enabled ? [breeder!, parentA!, parentB!] : undefined,
    query: { enabled, staleTime: 10_000 },
  });
}
