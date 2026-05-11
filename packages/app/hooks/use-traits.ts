"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { agentTraitCatalogContract } from "@/lib/contracts";

export type AgentTraits = {
  version: number;
  skills: string[];
  tools: string[];
  soulPreview?: string;
  generation?: number;
  description?: string;
};

function parseTraits(raw: string | undefined): AgentTraits | undefined {
  if (!raw || raw.length === 0) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<AgentTraits>;
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      skills: Array.isArray(parsed.skills) ? parsed.skills.map((s) => String(s)) : [],
      tools: Array.isArray(parsed.tools) ? parsed.tools.map((s) => String(s)) : [],
      soulPreview:
        typeof parsed.soulPreview === "string" ? parsed.soulPreview : undefined,
      generation:
        typeof parsed.generation === "number" ? parsed.generation : undefined,
      description:
        typeof parsed.description === "string" ? parsed.description : undefined,
    };
  } catch {
    return undefined;
  }
}

export function useTraits(tokenId: bigint | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...agentTraitCatalogContract,
    functionName: "traitsOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined, staleTime: 60_000 },
  });
  const traits = useMemo(
    () => parseTraits(data as string | undefined),
    [data]
  );
  return { traits, isLoading, error, refetch };
}

export function useTraitsBatch(ids: readonly bigint[]) {
  const uniqueIds = useMemo(() => {
    const seen = new Set<string>();
    const out: bigint[] = [];
    for (const id of ids) {
      const k = id.toString();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(id);
      }
    }
    return out;
  }, [ids]);

  const { data, isLoading } = useReadContracts({
    contracts: uniqueIds.map(
      (id) =>
        ({
          ...agentTraitCatalogContract,
          functionName: "traitsOf",
          args: [id],
        }) as const
    ),
    allowFailure: true,
    query: { enabled: uniqueIds.length > 0, staleTime: 60_000 },
  });

  const map = useMemo(() => {
    const m = new Map<string, AgentTraits>();
    if (!data) return m;
    uniqueIds.forEach((id, i) => {
      const res = data[i];
      if (res?.status !== "success") return;
      const parsed = parseTraits(res.result as string | undefined);
      if (parsed) m.set(id.toString(), parsed);
    });
    return m;
  }, [data, uniqueIds]);

  return { traits: map, isLoading };
}
