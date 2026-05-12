"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoundData } from "./use-rounds";

export type RoundLifecyclePhase =
  | "awaiting-commits"
  | "commits-closing"
  | "awaiting-reveals"
  | "reveals-closing"
  | "awaiting-oracle"
  | "resolved"
  | "non-existent";

export interface RoundLifecycle {
  phase: RoundLifecyclePhase;
  countdownSeconds: number;
  countdownLabel: string;
  daemonActive: boolean;
  headline: string;
  detail: string;
}

const COMMITS_CLOSING_THRESHOLD_S = 30;
const REVEALS_CLOSING_THRESHOLD_S = 30;

function fmtMmSs(s: number): string {
  const safe = Math.max(0, Math.floor(s));
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function useRoundLifecycle(round: RoundData | undefined): RoundLifecycle {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!round) return;
    if (round.resolved) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [round]);

  return useMemo<RoundLifecycle>(() => {
    if (!round) {
      return {
        phase: "non-existent",
        countdownSeconds: 0,
        countdownLabel: "0:00",
        daemonActive: false,
        headline: "Loading…",
        detail: "Reading round from 0G mainnet.",
      };
    }
    if (round.resolved) {
      return {
        phase: "resolved",
        countdownSeconds: 0,
        countdownLabel: "0:00",
        daemonActive: false,
        headline: `Resolved · outcome ${(round.outcome / 100).toFixed(2)}%`,
        detail:
          "The research oracle returned the truth and every agent's memory shard is anchored on-chain.",
      };
    }

    const commitDeadline = Number(round.commitDeadline);
    const revealDeadline = Number(round.revealDeadline);

    if (now <= commitDeadline) {
      const remaining = commitDeadline - now;
      if (remaining <= COMMITS_CLOSING_THRESHOLD_S) {
        return {
          phase: "commits-closing",
          countdownSeconds: remaining,
          countdownLabel: fmtMmSs(remaining),
          daemonActive: false,
          headline: `Commits close in ${fmtMmSs(remaining)}`,
          detail: `Owners can still enter agents. After the deadline, the daemon reveals all sealed commits automatically.`,
        };
      }
      return {
        phase: "awaiting-commits",
        countdownSeconds: remaining,
        countdownLabel: fmtMmSs(remaining),
        daemonActive: false,
        headline: `Open · ${round.totalCommitted.toString()} agents in`,
        detail: `Owners are sending agents in. Each entry runs the agent's full reasoning + live-data check before sealing.`,
      };
    }

    if (now <= revealDeadline) {
      const remaining = revealDeadline - now;
      if (remaining <= REVEALS_CLOSING_THRESHOLD_S) {
        return {
          phase: "reveals-closing",
          countdownSeconds: remaining,
          countdownLabel: fmtMmSs(remaining),
          daemonActive: true,
          headline: `Reveals close in ${fmtMmSs(remaining)}`,
          detail: `${round.totalRevealed.toString()} of ${round.totalCommitted.toString()} revealed. Truth-finding begins automatically once reveals close.`,
        };
      }
      return {
        phase: "awaiting-reveals",
        countdownSeconds: remaining,
        countdownLabel: fmtMmSs(remaining),
        daemonActive: true,
        headline: `Revealing · ${fmtMmSs(remaining)} left`,
        detail: `${round.totalRevealed.toString()} of ${round.totalCommitted.toString()} predictions revealed.`,
      };
    }

    const overrun = now - revealDeadline;
    return {
      phase: "awaiting-oracle",
      countdownSeconds: 0,
      countdownLabel: "0:00",
      daemonActive: true,
      headline: `Researching the answer · ${fmtMmSs(overrun)} so far`,
      detail: `Reveal closed. An AI is reading live data and on-chain state to derive the outcome.`,
    };
  }, [round, now]);
}
