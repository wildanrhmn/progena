"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { agentMetadataContract } from "@/lib/contracts";

export type EarnedSkill = {
  tokenId: bigint;
  skillName: string;
  skillRootHash: `0x${string}`;
  earnedInRound: bigint;
  earnedAt: bigint;
  attestor: `0x${string}`;
  reasoning: string;
};

export function useEarnedSkills(tokenId: bigint | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...agentMetadataContract,
    functionName: "earnedSkillsOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined, staleTime: 30_000 },
  });

  const skills = useMemo<EarnedSkill[]>(() => {
    if (!data) return [];
    return (data as readonly EarnedSkill[]).map((s) => ({
      tokenId: s.tokenId,
      skillName: s.skillName,
      skillRootHash: s.skillRootHash,
      earnedInRound: s.earnedInRound,
      earnedAt: s.earnedAt,
      attestor: s.attestor,
      reasoning: s.reasoning,
    }));
  }, [data]);

  return { skills, isLoading, error, refetch };
}
