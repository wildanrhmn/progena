"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import {
  agentGenomeContract,
  agentRegistryContract,
  reputationOracleContract,
} from "@/lib/contracts";

export type AgentRow = {
  id: bigint;
  name: string;
  rootHash: `0x${string}`;
  parentA: bigint;
  parentB: bigint;
  bornAt: bigint;
  generation: number;
  owner: Address;
  score: bigint;
  rounds: bigint;
};

export const displayNameOf = (row: AgentRow): string =>
  row.name && row.name.length > 0 ? row.name : `Agent #${row.id.toString()}`;

export function useTotalMinted() {
  return useReadContract({
    ...agentGenomeContract,
    functionName: "totalMinted",
    query: { staleTime: 15_000 },
  });
}

const CALLS_PER_AGENT = 5;

export function useAgentRows(ids: bigint[]) {
  const calls = useMemo(() => {
    return ids.flatMap((id) => [
      { ...agentGenomeContract, functionName: "agentOf", args: [id] } as const,
      { ...agentGenomeContract, functionName: "ownerOf", args: [id] } as const,
      { ...reputationOracleContract, functionName: "scoreOf", args: [id] } as const,
      { ...reputationOracleContract, functionName: "roundCountOf", args: [id] } as const,
      { ...agentRegistryContract, functionName: "nameOf", args: [id] } as const,
    ]);
  }, [ids]);

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: calls,
    allowFailure: true,
    query: { enabled: ids.length > 0, staleTime: 15_000 },
  });

  const agents = useMemo<AgentRow[]>(() => {
    if (!data) return [];
    const rows: AgentRow[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const base = i * CALLS_PER_AGENT;
      const agentRes = data[base];
      const ownerRes = data[base + 1];
      const scoreRes = data[base + 2];
      const roundsRes = data[base + 3];
      const nameRes = data[base + 4];
      if (
        agentRes?.status !== "success" ||
        ownerRes?.status !== "success"
      )
        continue;
      const agent = agentRes.result as {
        rootHash: `0x${string}`;
        parentA: bigint;
        parentB: bigint;
        bornAt: bigint;
        generation: number;
      };
      rows.push({
        id,
        name: nameRes?.status === "success" ? (nameRes.result as string) : "",
        rootHash: agent.rootHash,
        parentA: agent.parentA,
        parentB: agent.parentB,
        bornAt: agent.bornAt,
        generation: Number(agent.generation),
        owner: ownerRes.result as Address,
        score:
          scoreRes?.status === "success" ? (scoreRes.result as bigint) : 0n,
        rounds:
          roundsRes?.status === "success" ? (roundsRes.result as bigint) : 0n,
      });
    }
    return rows;
  }, [data, ids]);

  return { agents, isLoading, error, refetch };
}

export function useAgents(limit = 50) {
  const { data: totalRaw, isLoading: totalLoading, error: totalError } =
    useTotalMinted();

  const total = totalRaw ? Number(totalRaw) : 0;
  const ids = useMemo(() => {
    const ceiling = Math.min(total, limit);
    return Array.from({ length: ceiling }, (_, i) => BigInt(total - i));
  }, [total, limit]);

  const rows = useAgentRows(ids);
  return {
    ...rows,
    total,
    isLoading: totalLoading || rows.isLoading,
    error: totalError ?? rows.error,
  };
}

export function useFounders(count = 4) {
  const ids = useMemo(
    () => Array.from({ length: count }, (_, i) => BigInt(i + 1)),
    [count]
  );
  return useAgentRows(ids);
}
