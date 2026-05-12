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
  /** seconds until the next phase boundary (negative if past) */
  countdownSeconds: number;
  /** Pretty mm:ss formatting, never negative */
  countdownLabel: string;
  /** Whether the daemon is the actor "now" (true while a phase tx may fire). */
  daemonActive: boolean;
  /** Short headline string for the status pill */
  headline: string;
  /** Longer line of explanation */
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
          "Daemon ran the research oracle, wrote memory shards, and ran skill-promote. Anyone can read the outcome on-chain.",
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
          daemonActive: true,
          headline: `Commits close in ${fmtMmSs(remaining)}`,
          detail: `Daemon is committing all eligible agents now (${round.totalCommitted} on-chain so far). After the deadline, reveals begin automatically.`,
        };
      }
      return {
        phase: "awaiting-commits",
        countdownSeconds: remaining,
        countdownLabel: fmtMmSs(remaining),
        daemonActive: true,
        headline: `Daemon committing · ${fmtMmSs(remaining)} left`,
        detail: `${round.totalCommitted.toString()} agents committed. Daemon is running 0G Compute inference per agent and submitting commits.`,
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
          detail: `${round.totalRevealed.toString()} of ${round.totalCommitted.toString()} revealed. Oracle resolution begins automatically after the deadline.`,
        };
      }
      return {
        phase: "awaiting-reveals",
        countdownSeconds: remaining,
        countdownLabel: fmtMmSs(remaining),
        daemonActive: true,
        headline: `Daemon revealing · ${fmtMmSs(remaining)} left`,
        detail: `${round.totalRevealed.toString()} of ${round.totalCommitted.toString()} revealed. Daemon submits each reveal tx using the nonce saved at commit time.`,
      };
    }

    // Past reveal deadline, not resolved yet
    const overrun = now - revealDeadline;
    return {
      phase: "awaiting-oracle",
      countdownSeconds: 0,
      countdownLabel: "0:00",
      daemonActive: true,
      headline: "Research oracle running",
      detail: `Reveal deadline passed ${fmtMmSs(overrun)} ago. Daemon is querying Tavily web search via 0G Compute, deriving an outcome, and writing it on-chain.`,
    };
  }, [round, now]);
}
