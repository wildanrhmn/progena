"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { Address } from "viem";
import { useOwnedAgents } from "@/hooks/use-owned-agents";
import { useOwnedEarnedSkills } from "@/hooks/use-owned-earned-skills";
import { dispatchEarnedSkillToast } from "./earned-skill-toast";

const STORAGE_KEY = "progena:known-earned-skills:v1";

type Snapshot = Record<string, string[]>;

function readSnapshot(owner: string): Snapshot {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${owner}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Snapshot;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function writeSnapshot(owner: string, snap: Snapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY}:${owner}`,
      JSON.stringify(snap)
    );
  } catch {}
}

export function EarnedSkillWatcher() {
  const { user } = usePrivy();
  const owner = (user?.wallet?.address as Address | undefined)?.toLowerCase() as
    | Address
    | undefined;

  const { agents } = useOwnedAgents(owner);
  const ownedTokenIds = useMemo(() => agents.map((a) => a.id), [agents]);
  const nameByTokenId = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) {
      if (a.name && a.name.length > 0) map.set(a.id.toString(), a.name);
    }
    return map;
  }, [agents]);

  const { rows } = useOwnedEarnedSkills(ownedTokenIds);

  const baselineLoaded = useRef<string | null>(null);

  useEffect(() => {
    if (!owner) return;
    if (rows.length === 0) return;

    const knownKey = owner.toLowerCase();
    const snapshot = readSnapshot(knownKey);
    const firstRunForThisOwner = baselineLoaded.current !== knownKey;

    const nextSnapshot: Snapshot = { ...snapshot };
    let updated = false;

    for (const row of rows) {
      const key = row.tokenId.toString();
      const current = row.skills.map((s) => s.skillName);
      const previous = snapshot[key] ?? (firstRunForThisOwner ? null : []);

      if (previous === null) {
        nextSnapshot[key] = current;
        updated = true;
        continue;
      }

      const previousSet = new Set(previous);
      const newOnes = row.skills.filter(
        (s) => !previousSet.has(s.skillName)
      );

      if (newOnes.length > 0) {
        const resolvedName = nameByTokenId.get(key);
        if (resolvedName === undefined && nameByTokenId.size === 0) {
          continue;
        }
        const agentName = resolvedName ?? `Agent #${key}`;
        for (const skill of newOnes) {
          dispatchEarnedSkillToast({
            agentTokenId: row.tokenId.toString(),
            agentName,
            skillName: skill.skillName,
            reasoning: skill.reasoning,
            earnedInRound: skill.earnedInRound.toString(),
          });
        }
        nextSnapshot[key] = current;
        updated = true;
      } else if (current.length !== previous.length) {
        nextSnapshot[key] = current;
        updated = true;
      }
    }

    if (updated) writeSnapshot(knownKey, nextSnapshot);
    baselineLoaded.current = knownKey;
  }, [owner, rows, nameByTokenId]);

  return null;
}
