"use client";

import { useQuery } from "@tanstack/react-query";

export type ShardToolCall = {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  ok: boolean;
  durationMs: number;
};

export type MemoryShard = {
  version: number;
  agentId: string;
  roundId: string;
  questionHash: `0x${string}`;
  myPrediction: number;
  actualOutcome: number;
  scoreDelta: number;
  lesson: string;
  recordedAt: number;
  toolCalls?: ShardToolCall[];
  inferenceModel?: string;
  inferenceIterations?: number;
  reasoningPreview?: string;
};

async function fetchShard(rootHash: string): Promise<MemoryShard> {
  const res = await fetch(`/api/shard/${rootHash}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `shard fetch failed: ${res.status}`);
  }
  return (await res.json()) as MemoryShard;
}

export function useShard(rootHash: string | undefined) {
  const query = useQuery({
    queryKey: ["shard", rootHash],
    queryFn: () => fetchShard(rootHash!),
    enabled: !!rootHash,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
  return {
    shard: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
