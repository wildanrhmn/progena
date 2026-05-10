"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CircleHalf,
  GitFork,
  Sparkle,
  Trophy,
} from "@phosphor-icons/react";
import {
  formatRelative,
  formatScore,
  generationLabel,
  shortAddress,
  shortHash,
} from "@/lib/format";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";

const accentForGen = (gen: number): string => {
  if (gen === 0) return "text-accent-life";
  if (gen <= 2) return "text-accent-lineage";
  return "text-foreground";
};

export function AgentCard({ agent, index = 0 }: { agent: AgentRow; index?: number }) {
  const isGenesis = agent.generation === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
    >
      <Link
        href={`/agents/${agent.id.toString()}`}
        className="group block rounded-lg border border-border-soft bg-muted/20 p-5 transition-colors hover:border-border hover:bg-muted/40"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CircleHalf
              size={18}
              weight="duotone"
              className={accentForGen(agent.generation)}
            />
            <div>
              <div className="text-base font-medium tracking-tight text-foreground">
                {displayNameOf(agent)}
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {agent.name ? `#${agent.id.toString()} · ` : ""}
                {generationLabel(agent.generation)} ·{" "}
                {formatRelative(agent.bornAt)}
              </div>
            </div>
          </div>
          <ArrowRight
            size={14}
            className="text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div>
            <div className="mb-1 flex items-center gap-1 text-muted-foreground">
              <Trophy size={11} weight="bold" />
              Reputation
            </div>
            <div className="font-mono text-sm tabular-nums text-foreground">
              {formatScore(agent.score)}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1 text-muted-foreground">
              <Sparkle size={11} weight="bold" />
              Rounds
            </div>
            <div className="font-mono text-sm tabular-nums text-foreground">
              {agent.rounds.toString()}
            </div>
          </div>

          <div className="col-span-2">
            <div className="mb-1 flex items-center gap-1 text-muted-foreground">
              <GitFork size={11} weight="bold" />
              Lineage
            </div>
            <div className="font-mono text-xs text-foreground">
              {isGenesis
                ? "— · genesis seed"
                : `#${agent.parentA.toString()} × #${agent.parentB.toString()}`}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border-soft pt-3 text-[11px]">
          <span className="font-mono text-muted-foreground">
            {shortHash(agent.rootHash)}
          </span>
          <span className="font-mono text-muted-foreground">
            owned by {shortAddress(agent.owner)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
