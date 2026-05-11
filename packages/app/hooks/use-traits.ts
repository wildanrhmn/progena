"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { agentMetadataContract } from "@/lib/contracts";

export type AgentTraits = {
  version: number;
  skills: string[];
  tools: string[];
  soulPreview?: string;
  generation?: number;
  description?: string;
  synthesizedSoul?: boolean;
  hybridSkillName?: string;
  hybridSourceSkills?: [string, string];
  synthesizedToolName?: string;
  synthesizedToolSourceTools?: string[];
};

function parseTraits(raw: string | undefined): AgentTraits | undefined {
  if (!raw || raw.length === 0) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<AgentTraits>;
    const sources = parsed.hybridSourceSkills;
    const hybridSourceSkills =
      Array.isArray(sources) && sources.length === 2
        ? ([String(sources[0]), String(sources[1])] as [string, string])
        : undefined;
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
      synthesizedSoul:
        typeof parsed.synthesizedSoul === "boolean" ? parsed.synthesizedSoul : undefined,
      hybridSkillName:
        typeof parsed.hybridSkillName === "string" ? parsed.hybridSkillName : undefined,
      hybridSourceSkills,
      synthesizedToolName:
        typeof parsed.synthesizedToolName === "string" ? parsed.synthesizedToolName : undefined,
      synthesizedToolSourceTools: Array.isArray(parsed.synthesizedToolSourceTools)
        ? parsed.synthesizedToolSourceTools.map((s) => String(s))
        : undefined,
    };
  } catch {
    return undefined;
  }
}

export function useTraits(tokenId: bigint | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...agentMetadataContract,
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
          ...agentMetadataContract,
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
