"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { formatEther, type Address } from "viem";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleNotch,
  Coin,
  EyeSlash,
  Lightning,
  Plus,
  Trophy,
  Users,
} from "@phosphor-icons/react";
import {
  useRound,
  useRoundAgents,
  useCommitment,
} from "@/hooks/use-rounds";
import { useOwnedAgents } from "@/hooks/use-owned-agents";
import { useNames, nameOrId } from "@/hooks/use-names";
import { useAgentRows } from "@/hooks/use-agents";
import { Panel, BracketBox } from "@/components/ui/panel";
import { RoundStatusPill } from "./round-status-pill";
import { CommitDialog } from "./commit-dialog";
import { RevealDialog } from "./reveal-dialog";
import { useRoundQuestion } from "@/hooks/use-round-question";
import { loadCommit } from "@/lib/commit";
import {
  formatRelative,
  formatTimestamp,
  shortAddress,
  shortHash,
} from "@/lib/format";
import type { AgentRow } from "@/hooks/use-agents";

type Props = { roundId: bigint };

export function RoundDetail({ roundId }: Props) {
  const { round, isLoading, error, refetch } = useRound(roundId);
  const { data: agentIdsRaw, refetch: refetchAgents } = useRoundAgents(roundId);
  const agentIds = (agentIdsRaw as readonly bigint[] | undefined) ?? [];
  const committedAgents = useAgentRows([...agentIds]);

  const { text: question } = useRoundQuestion(roundId);

  const { authenticated, user } = usePrivy();
  const viewer = (
    authenticated ? user?.wallet?.address : undefined
  ) as Address | undefined;
  const { agents: ownedAgents } = useOwnedAgents(viewer);

  // names for committed agents
  const names = useNames([...agentIds]);

  const [commitOpen, setCommitOpen] = useState(false);
  const [revealAgent, setRevealAgent] = useState<AgentRow | undefined>();

  if (isLoading && !round) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <CircleNotch size={14} className="mr-2 animate-spin" />
        Reading round #{roundId.toString()} from 0G mainnet…
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
        <div className="mb-1 text-sm font-medium text-foreground">
          Couldn't load round #{roundId.toString()}
        </div>
        <p className="text-xs text-muted-foreground">
          {error?.message ?? "Round may not exist on this network."}
        </p>
      </div>
    );
  }

  const eligibleToCommit = round.status === "Open" && ownedAgents.length > 0;
  const eligibleAgentsForReveal = ownedAgents.filter((a) => {
    if (round.status !== "RevealPhase") return false;
    return !!loadCommit(roundId, a.id);
  });

  return (
    <div className="space-y-6">
      <Link
        href="/rounds"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} weight="bold" />
        Back to rounds
      </Link>

      {/* Hero */}
      <Panel>
        <div className="grid gap-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <RoundStatusPill status={round.status} />
            {round.resolved && (
              <span className="rounded-full border border-accent-life/40 bg-accent-life/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-life">
                Outcome {(round.outcome / 100).toFixed(2)}%
              </span>
            )}
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              Round #{round.id.toString()}
            </span>
          </div>

          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
              Question
            </div>
            {question ? (
              <h1 className="text-balance font-display text-3xl leading-snug tracking-tight text-foreground sm:text-4xl">
                {question}
              </h1>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">
                  Question text not registered in this UI's catalog.
                </p>
                <p className="mt-1 font-mono text-xs text-foreground/70">
                  hash {round.questionHash}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Entry fee"
              value={`${formatEther(round.entryFee)} OG`}
              icon={<Coin size={11} weight="bold" />}
            />
            <Field
              label="Prize pool"
              value={`${formatEther(round.totalPool)} OG`}
              icon={<Trophy size={11} weight="bold" />}
            />
            <Field
              label="Committed"
              value={round.totalCommitted.toString()}
              icon={<Users size={11} weight="bold" />}
            />
            <Field
              label="Revealed"
              value={round.totalRevealed.toString()}
              icon={<EyeSlash size={11} weight="bold" />}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DeadlineRow
              label="Commit ends"
              ts={round.commitDeadline}
              active={round.status === "Open"}
            />
            <DeadlineRow
              label="Reveal ends"
              ts={round.revealDeadline}
              active={round.status === "RevealPhase"}
            />
          </div>

          {viewer && (
            <div className="flex flex-wrap gap-3 border-t border-white/10 pt-5">
              {round.status === "Open" && (
                <button
                  onClick={() => setCommitOpen(true)}
                  disabled={!eligibleToCommit}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={14} weight="bold" />
                  {ownedAgents.length === 0
                    ? "No agents to commit"
                    : "Commit an agent"}
                </button>
              )}
              {round.status === "RevealPhase" && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Reveal:
                  </span>
                  {eligibleAgentsForReveal.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      no saved commits in this browser
                    </span>
                  ) : (
                    eligibleAgentsForReveal.map((a) => (
                      <button
                        key={a.id.toString()}
                        onClick={() => setRevealAgent(a)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-900/20 px-3 py-1.5 text-xs text-amber-200 transition-colors hover:bg-amber-900/40"
                      >
                        <Lightning size={11} weight="bold" />
                        {nameOrId(a.id, names) === a.id.toString()
                          ? `#${a.id}`
                          : nameOrId(a.id, names)}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Committed agents */}
      <Panel>
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
              <Users size={12} weight="bold" />
              Committed agents
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {committedAgents.agents.length} of {agentIds.length}
            </span>
          </div>
          {agentIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agents have committed to this round yet.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {committedAgents.agents.map((a) => (
                <AgentRow
                  key={a.id.toString()}
                  agent={a}
                  roundId={roundId}
                  viewerOwns={
                    !!viewer &&
                    a.owner.toLowerCase() === viewer.toLowerCase()
                  }
                  resolved={round.resolved}
                />
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* Genome anchor */}
      <Panel>
        <div className="p-6">
          <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-white/55">
            On-chain record
          </div>
          <dl className="grid gap-y-3 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="text-muted-foreground">Question hash</dt>
            <dd className="break-all font-mono text-foreground">
              {round.questionHash}
            </dd>

            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-foreground">
              {formatTimestamp(round.commitDeadline)} (commit deadline)
            </dd>

            <dt className="text-muted-foreground">Total pool</dt>
            <dd className="font-mono text-foreground">
              {formatEther(round.totalPool)} OG
            </dd>
          </dl>
        </div>
      </Panel>

      {viewer && round.status === "Open" && (
        <CommitDialog
          roundId={roundId}
          entryFee={round.entryFee}
          ownedAgents={ownedAgents}
          open={commitOpen}
          onClose={() => setCommitOpen(false)}
          onSuccess={() => {
            refetch();
            refetchAgents();
          }}
        />
      )}
      {viewer && revealAgent && (
        <RevealDialog
          roundId={roundId}
          agent={revealAgent}
          open={!!revealAgent}
          onClose={() => setRevealAgent(undefined)}
          onSuccess={() => {
            refetch();
            refetchAgents();
          }}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/55">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl font-light text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

function DeadlineRow({
  label,
  ts,
  active,
}: {
  label: string;
  ts: bigint;
  active: boolean;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-foreground">
          {formatTimestamp(ts)}
        </span>
        <span
          className={`text-xs ${
            active ? "text-accent-life" : "text-muted-foreground"
          }`}
        >
          ({formatRelative(ts)})
        </span>
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  roundId,
  viewerOwns,
  resolved,
}: {
  agent: AgentRow;
  roundId: bigint;
  viewerOwns: boolean;
  resolved: boolean;
}) {
  const { data: commitmentRaw } = useCommitment(roundId, agent.id);
  const commitment = commitmentRaw as
    | {
        commitHash: `0x${string}`;
        prediction: number;
        revealed: boolean;
        exists: boolean;
      }
    | undefined;
  const display = agent.name && agent.name.length > 0 ? agent.name : `Agent #${agent.id}`;

  return (
    <li className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <Link
          href={`/agents/${agent.id.toString()}`}
          className="flex items-center gap-2 truncate text-sm text-foreground hover:text-accent-life"
        >
          {display}
          <ArrowUpRight size={11} className="text-muted-foreground" />
        </Link>
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          owner {shortAddress(agent.owner)}
          {viewerOwns && (
            <span className="ml-2 text-accent-life">you</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        {commitment?.revealed ? (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              Revealed
            </div>
            <div className="font-mono text-sm text-foreground">
              {(commitment.prediction / 100).toFixed(2)}%
            </div>
          </div>
        ) : commitment?.exists ? (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/45">
              Sealed
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {shortHash(commitment.commitHash, 6, 4)}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">—</div>
        )}
      </div>
    </li>
  );
}
