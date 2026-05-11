"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import {
  ArrowUpRight,
  Coin,
  Hash,
  Question,
  Sparkle,
  Users,
} from "@phosphor-icons/react";
import type { RoundData } from "@/hooks/use-rounds";
import { useRoundQuestion } from "@/hooks/use-round-question";
import { formatRelative, shortHash } from "@/lib/format";
import { RoundStatusPill } from "./round-status-pill";

const CLIP =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)";

const DOT_BG: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.32) 0.7px, transparent 0.7px)",
  backgroundSize: "6px 6px",
};

export function RoundCard({ round, index = 0 }: { round: RoundData; index?: number }) {
  const { text: question } = useRoundQuestion(round.id);
  const phaseDeadline =
    round.status === "Open"
      ? round.commitDeadline
      : round.status === "RevealPhase"
        ? round.revealDeadline
        : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className="p-px"
      style={{ clipPath: CLIP, background: "rgba(255,255,255,0.18)" }}
    >
      <Link
        href={`/rounds/${round.id.toString()}`}
        className="group relative block h-full bg-[#0a0a0a] text-foreground transition-colors hover:bg-[#0d0d0d]"
        style={{ clipPath: CLIP }}
        aria-label={`Open round #${round.id}`}
      >
        <div className="relative px-5 pt-5 sm:pt-6">
          <div className="relative border border-dashed border-white/22 p-5" style={DOT_BG}>
            <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-white/70" />
            <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-white/70" />
            <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-white/70" />
            <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-white/70" />

            <div className="mb-3 flex items-center justify-between gap-2">
              <RoundStatusPill status={round.status} />
              <ArrowUpRight
                size={14}
                weight="bold"
                className="text-white/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </div>

            <div className="mb-3 flex items-start gap-2">
              {!question && (
                <Question
                  size={14}
                  weight="bold"
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
              )}
              <p className="line-clamp-3 text-sm leading-snug text-foreground">
                {question ?? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {shortHash(round.questionHash, 10, 8)}
                  </span>
                )}
              </p>
            </div>

            <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Hash size={10} weight="bold" />
              round #{round.id.toString()}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/20 px-5 py-4 text-xs">
          <Stat
            icon={<Coin size={11} weight="bold" />}
            label="Entry"
            value={`${formatEther(round.entryFee)} OG`}
          />
          <Stat
            icon={<Sparkle size={11} weight="bold" />}
            label="Pool"
            value={`${formatEther(round.totalPool)} OG`}
          />
          <Stat
            icon={<Users size={11} weight="bold" />}
            label="Committed"
            value={round.totalCommitted.toString()}
          />
          <Stat
            label={
              round.status === "Open"
                ? "Commit ends"
                : round.status === "RevealPhase"
                  ? "Reveal ends"
                  : round.status === "Resolved"
                    ? "Outcome"
                    : "Closed"
            }
            value={
              round.status === "Resolved"
                ? `${(round.outcome / 100).toFixed(2)}%`
                : phaseDeadline !== undefined
                  ? formatRelative(phaseDeadline)
                  : "—"
            }
          />
        </div>
      </Link>
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-white/55">
        {icon}
        {label}
      </div>
      <div className="truncate font-mono tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
