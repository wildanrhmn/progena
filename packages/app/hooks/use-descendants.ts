"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { agentGenomeContract } from "@/lib/contracts";

export type Descendant = {
  id: bigint;
  otherParent: bigint;
  generation: number;
  bornAt: bigint;
};

export function useDescendants(parentId: bigint | undefined) {
  const { data: totalRaw } = useReadContract({
    ...agentGenomeContract,
    functionName: "totalMinted",
    query: { staleTime: 30_000 },
  });

  const candidateIds = useMemo(() => {
    if (parentId === undefined || totalRaw === undefined) return [];
    const total = Number(totalRaw);
    const start = Number(parentId) + 1;
    if (start > total) return [];
    return Array.from({ length: total - start + 1 }, (_, i) => BigInt(start + i));
  }, [parentId, totalRaw]);

  const { data, isLoading } = useReadContracts({
    contracts: candidateIds.map(
      (id) =>
        ({
          ...agentGenomeContract,
          functionName: "agentOf",
          args: [id],
        }) as const
    ),
    allowFailure: true,
    query: { enabled: candidateIds.length > 0, staleTime: 30_000 },
  });

  const descendants = useMemo<Descendant[]>(() => {
    if (!data || parentId === undefined) return [];
    const out: Descendant[] = [];
    candidateIds.forEach((id, i) => {
      const r = data[i];
      if (r?.status !== "success") return;
      const a = r.result as {
        parentA: bigint;
        parentB: bigint;
        generation: number;
        bornAt: bigint;
      };
      if (a.parentA === parentId) {
        out.push({
          id,
          otherParent: a.parentB,
          generation: Number(a.generation),
          bornAt: a.bornAt,
        });
      } else if (a.parentB === parentId) {
        out.push({
          id,
          otherParent: a.parentA,
          generation: Number(a.generation),
          bornAt: a.bornAt,
        });
      }
    });
    return out;
  }, [data, candidateIds, parentId]);

  return { descendants, isLoading };
}
