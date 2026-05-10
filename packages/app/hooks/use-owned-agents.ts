"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { agentGenomeContract } from "@/lib/contracts";
import { useAgentRows } from "./use-agents";

export function useOwnedAgents(owner: Address | undefined) {
  const { data: totalRaw, isLoading: totalLoading } = useReadContract({
    ...agentGenomeContract,
    functionName: "totalMinted",
    query: { staleTime: 30_000 },
  });

  const ids = useMemo(() => {
    if (!totalRaw) return [];
    return Array.from({ length: Number(totalRaw) }, (_, i) => BigInt(i + 1));
  }, [totalRaw]);

  const { data: ownerData, isLoading: ownersLoading } = useReadContracts({
    contracts: ids.map(
      (id) =>
        ({
          ...agentGenomeContract,
          functionName: "ownerOf",
          args: [id],
        }) as const
    ),
    allowFailure: true,
    query: { enabled: ids.length > 0 && !!owner, staleTime: 30_000 },
  });

  const ownedIds = useMemo(() => {
    if (!ownerData || !owner) return [];
    const lower = owner.toLowerCase();
    return ids.filter((_, i) => {
      const r = ownerData[i];
      return (
        r?.status === "success" &&
        (r.result as Address).toLowerCase() === lower
      );
    });
  }, [ownerData, ids, owner]);

  const sortedOwnedIds = useMemo(
    () => [...ownedIds].reverse(),
    [ownedIds]
  );

  const rows = useAgentRows(sortedOwnedIds);

  return {
    agents: rows.agents,
    ownedCount: ownedIds.length,
    isLoading: totalLoading || ownersLoading || rows.isLoading,
    error: rows.error,
  };
}
