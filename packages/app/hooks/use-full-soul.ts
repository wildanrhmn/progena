"use client";

import { useQuery } from "@tanstack/react-query";

interface FullTraitsResponse {
  soulFull?: string;
  error?: string;
}

async function fetchSoulFull(tokenId: bigint): Promise<string | undefined> {
  const res = await fetch(`/api/traits-for/${tokenId.toString()}`);
  if (!res.ok) {
    return undefined;
  }
  const body = (await res.json()) as FullTraitsResponse;
  return body.soulFull;
}

export function useFullSoul(tokenId: bigint | undefined) {
  const query = useQuery({
    queryKey: ["full-soul", tokenId?.toString()],
    queryFn: () => fetchSoulFull(tokenId!),
    enabled: tokenId !== undefined,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });
  return {
    soulFull: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
