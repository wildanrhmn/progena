"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { agentMetadataContract } from "@/lib/contracts";
import type { EarnedSkill } from "./use-earned-skills";

export interface OwnedEarnedSkills {
  tokenId: bigint;
  skills: EarnedSkill[];
}

export function useOwnedEarnedSkills(tokenIds: bigint[]) {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: tokenIds.map(
      (id) =>
        ({
          ...agentMetadataContract,
          functionName: "earnedSkillsOf",
          args: [id],
        }) as const
    ),
    allowFailure: true,
    query: {
      enabled: tokenIds.length > 0,
      staleTime: 5_000,
      refetchInterval: 8_000,
    },
  });

  const rows = useMemo<OwnedEarnedSkills[]>(() => {
    if (!data) return [];
    return tokenIds.map((tokenId, i) => {
      const r = data[i];
      if (r?.status !== "success" || !r.result) {
        return { tokenId, skills: [] };
      }
      const skills = (r.result as readonly EarnedSkill[]).map((s) => ({
        tokenId: s.tokenId,
        skillName: s.skillName,
        skillRootHash: s.skillRootHash,
        earnedInRound: s.earnedInRound,
        earnedAt: s.earnedAt,
        attestor: s.attestor,
        reasoning: s.reasoning,
      }));
      return { tokenId, skills };
    });
  }, [data, tokenIds]);

  return { rows, isLoading, error, refetch };
}
