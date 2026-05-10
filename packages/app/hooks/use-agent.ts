"use client";

import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import {
  agentGenomeContract,
  agentMemoryContract,
  agentRegistryContract,
  reputationOracleContract,
} from "@/lib/contracts";
import type { AgentRow } from "./use-agents";

export function useAgent(id: bigint | undefined) {
  const enabled = id !== undefined;
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: enabled
      ? [
          { ...agentGenomeContract, functionName: "agentOf", args: [id!] } as const,
          { ...agentGenomeContract, functionName: "ownerOf", args: [id!] } as const,
          { ...agentGenomeContract, functionName: "isFinalized", args: [id!] } as const,
          { ...reputationOracleContract, functionName: "scoreOf", args: [id!] } as const,
          { ...reputationOracleContract, functionName: "averageScoreOf", args: [id!] } as const,
          { ...reputationOracleContract, functionName: "roundCountOf", args: [id!] } as const,
          { ...agentRegistryContract, functionName: "nameOf", args: [id!] } as const,
        ]
      : [],
    allowFailure: true,
    query: { enabled, staleTime: 15_000 },
  });

  if (!data || data[0]?.status !== "success" || data[1]?.status !== "success") {
    return { agent: undefined, averageScore: 0n, isFinalized: false, isLoading, error, refetch };
  }

  const tuple = data[0].result as {
    rootHash: `0x${string}`;
    parentA: bigint;
    parentB: bigint;
    bornAt: bigint;
    generation: number;
  };

  const agent: AgentRow = {
    id: id!,
    name: data[6]?.status === "success" ? (data[6].result as string) : "",
    rootHash: tuple.rootHash,
    parentA: tuple.parentA,
    parentB: tuple.parentB,
    bornAt: tuple.bornAt,
    generation: Number(tuple.generation),
    owner: data[1].result as Address,
    score: data[3]?.status === "success" ? (data[3].result as bigint) : 0n,
    rounds: data[5]?.status === "success" ? (data[5].result as bigint) : 0n,
  };

  const averageScore =
    data[4]?.status === "success" ? (data[4].result as bigint) : 0n;
  const isFinalized =
    data[2]?.status === "success" ? (data[2].result as boolean) : false;

  return { agent, averageScore, isFinalized, isLoading, error, refetch };
}

export function useAgentMemoryShards(id: bigint | undefined, n = 8) {
  const enabled = id !== undefined;
  const { data, isLoading, error } = useReadContracts({
    contracts: enabled
      ? [
          { ...agentMemoryContract, functionName: "shardCountOf", args: [id!] } as const,
          { ...agentMemoryContract, functionName: "recentShardsOf", args: [id!, BigInt(n)] } as const,
        ]
      : [],
    allowFailure: true,
    query: { enabled, staleTime: 15_000 },
  });

  const count =
    data?.[0]?.status === "success" ? (data[0].result as bigint) : 0n;
  const shards =
    data?.[1]?.status === "success"
      ? ((data[1].result as readonly `0x${string}`[]) ?? [])
      : [];

  return { count, shards: [...shards].reverse(), isLoading, error };
}
