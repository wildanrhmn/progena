"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { agentGenomeContract } from "@/lib/contracts";
import type { ChildTraits } from "@/lib/traits";

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function useChildFinalization(tokenId: bigint | undefined) {
  const { data, isFetching } = useReadContract({
    ...agentGenomeContract,
    functionName: "rootHashOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
      refetchInterval: (q) => {
        const v = q.state.data as string | undefined;
        if (v && v !== ZERO_HASH) return false;
        return 3000;
      },
      staleTime: 0,
    },
  });

  const rootHash = data as `0x${string}` | undefined;
  const finalized = !!rootHash && rootHash !== ZERO_HASH;
  return { rootHash, finalized, polling: !finalized && isFetching };
}

type TraitsResponse = {
  traits: ChildTraits;
  traitsJson: string;
  rootHash: `0x${string}`;
};

async function fetchChildTraits(tokenId: bigint): Promise<TraitsResponse> {
  const res = await fetch(`/api/traits-for/${tokenId.toString()}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `traits fetch failed: ${res.status}`);
  }
  return (await res.json()) as TraitsResponse;
}

export function useChildTraits(tokenId: bigint | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ["child-traits", tokenId?.toString()],
    queryFn: () => fetchChildTraits(tokenId!),
    enabled: tokenId !== undefined && enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return {
    traits: query.data?.traits,
    traitsJson: query.data?.traitsJson,
    rootHash: query.data?.rootHash,
    isLoading: query.isLoading || query.isFetching,
    error: query.error as Error | null,
  };
}
