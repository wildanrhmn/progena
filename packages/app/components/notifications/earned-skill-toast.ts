export interface EarnedSkillToastPayload {
  id: string;
  agentTokenId: string;
  agentName: string;
  skillName: string;
  reasoning: string;
  earnedInRound: string;
}

export const EARNED_SKILL_EVENT = "progena:skill-earned";

export function dispatchEarnedSkillToast(
  payload: Omit<EarnedSkillToastPayload, "id">
): void {
  if (typeof window === "undefined") return;
  const full: EarnedSkillToastPayload = {
    ...payload,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  window.dispatchEvent(new CustomEvent(EARNED_SKILL_EVENT, { detail: full }));
}
