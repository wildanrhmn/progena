"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import makeBlockie from "ethereum-blockies-base64";
import { ArrowUpRight, GitFork, Trophy } from "@phosphor-icons/react";
import {
  formatRelative,
  formatScore,
  generationLabel,
  shortAddress,
  shortHash,
} from "@/lib/format";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";

const CLIP =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)";

const DOT_BG: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.32) 0.7px, transparent 0.7px)",
  backgroundSize: "6px 6px",
};

const tagForGen = (gen: number): { label: string; tone: string } => {
  if (gen === 0)
    return {
      label: "Genesis",
      tone: "border-accent-life/40 bg-accent-life/10 text-accent-life",
    };
  return {
    label: `Gen ${gen}`,
    tone: "border-accent-lineage/40 bg-accent-lineage/10 text-accent-lineage",
  };
};

export function AgentCard({ agent, index = 0 }: { agent: AgentRow; index?: number }) {
  const isGenesis = agent.generation === 0;
  const tag = tagForGen(agent.generation);
  const sigil = makeBlockie(agent.rootHash);
  const ownerSigil = makeBlockie(agent.owner);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className="p-px"
      style={{ clipPath: CLIP, background: "rgba(255,255,255,0.18)" }}
    >
      <Link
        href={`/agents/${agent.id.toString()}`}
        className="group relative block h-full bg-[#0a0a0a] text-foreground transition-colors hover:bg-[#0d0d0d]"
        style={{ clipPath: CLIP }}
        aria-label={`Open ${displayNameOf(agent)}`}
      >
        <div className="px-5 pt-5 sm:pt-6">
          <div className="relative border border-dashed border-white/22">
            <div
              className="flex h-44 w-full items-center justify-center p-4"
              style={DOT_BG}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sigil}
                alt=""
                className="h-28 w-28 rounded-sm border border-white/15 [image-rendering:pixelated]"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-white/70" />
            <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-white/70" />
            <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-white/70" />
            <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-white/70" />

            <span
              className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tag.tone}`}
            >
              {tag.label}
            </span>

            <ArrowUpRight
              size={14}
              weight="bold"
              className="absolute right-2 top-2 text-white/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </div>
        </div>

        <div className="mt-5 border-t border-white/20 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {displayNameOf(agent)}
            </h3>
            <span className="shrink-0 font-mono text-[11px] text-white/45">
              #{agent.id.toString()}
            </span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-white/45">
            {generationLabel(agent.generation)} ·{" "}
            {formatRelative(agent.bornAt)}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-white/55">
              <Trophy size={11} weight="bold" />
              Reputation
            </div>
            <div className="text-right font-mono tabular-nums text-foreground">
              {formatScore(agent.score)}
            </div>

            <div className="flex items-center gap-1.5 text-white/55">
              <GitFork size={11} weight="bold" />
              Lineage
            </div>
            <div className="text-right font-mono text-foreground">
              {isGenesis
                ? "genesis"
                : `#${agent.parentA.toString()} × #${agent.parentB.toString()}`}
            </div>

            <div className="text-white/55">Rounds</div>
            <div className="text-right font-mono tabular-nums text-foreground">
              {agent.rounds.toString()}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="font-mono text-[10px] text-white/40">
              {shortHash(agent.rootHash, 6, 4)}
            </span>
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ownerSigil}
                alt=""
                className="h-4 w-4 rounded-sm border border-white/15 [image-rendering:pixelated]"
              />
              <span className="font-mono text-[10px] text-white/55">
                {shortAddress(agent.owner)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
