"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import makeBlockie from "ethereum-blockies-base64";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CircleNotch,
  GitFork,
  Trophy,
} from "@phosphor-icons/react";
import { useAgent, useAgentMemoryShards } from "@/hooks/use-agent";
import { displayNameOf } from "@/hooks/use-agents";
import { Panel, BracketBox } from "@/components/ui/panel";
import { SetNameButton } from "./set-name-dialog";
import {
  formatRelative,
  formatScore,
  formatTimestamp,
  generationLabel,
  shortAddress,
  shortHash,
  explorerAddress,
} from "@/lib/format";
import { ADDRESSES } from "@/lib/chain";

type Props = {
  agentId: bigint;
};

export function AgentDetail({ agentId }: Props) {
  const { agent, averageScore, isFinalized, isLoading, error, refetch } =
    useAgent(agentId);
  const { shards } = useAgentMemoryShards(agentId, 8);
  const { address: viewer } = useAccount();

  if (isLoading && !agent) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <CircleNotch size={14} className="mr-2 animate-spin" />
        Reading agent #{agentId.toString()} from 0G mainnet…
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
        <div className="mb-1 text-sm font-medium text-foreground">
          Couldn't load agent #{agentId.toString()}
        </div>
        <p className="text-xs text-muted-foreground">
          {error?.message ?? "Token may not exist on this network."}
        </p>
      </div>
    );
  }

  const isOwner =
    !!viewer && viewer.toLowerCase() === agent.owner.toLowerCase();
  const isGenesis = agent.generation === 0;
  const sigil = makeBlockie(agent.rootHash);
  const ownerSigil = makeBlockie(agent.owner);
  const tag = isGenesis
    ? {
        label: "Genesis",
        tone: "border-accent-life/40 bg-accent-life/10 text-accent-life",
      }
    : {
        label: `Gen ${agent.generation}`,
        tone: "border-accent-lineage/40 bg-accent-lineage/10 text-accent-lineage",
      };

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} weight="bold" />
        Back to agents
      </Link>

      {/* Hero */}
      <Panel>
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:gap-10">
          <BracketBox className="flex h-56 w-56 items-center justify-center p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sigil}
              alt=""
              className="h-40 w-40 rounded-sm border border-white/15"
              style={{ imageRendering: "pixelated" }}
            />
          </BracketBox>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tag.tone}`}
              >
                {tag.label}
              </span>
              {isFinalized ? (
                <span className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
                  Finalized
                </span>
              ) : (
                <span className="rounded-full border border-amber-700/50 bg-amber-900/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                  Not finalized
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">
                Token #{agent.id.toString()}
              </span>
            </div>

            <h1 className="mt-3 text-balance text-4xl tracking-tight text-foreground sm:text-5xl">
              {agent.name ? (
                agent.name
              ) : (
                <span className="text-muted-foreground">
                  Agent #{agent.id.toString()}
                </span>
              )}
            </h1>

            <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/40">
                  Born
                </span>
                <div className="text-foreground">
                  {formatTimestamp(agent.bornAt)}{" "}
                  <span className="text-muted-foreground">
                    · {formatRelative(agent.bornAt)}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/40">
                  Owner
                </span>
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ownerSigil}
                    alt=""
                    className="h-4 w-4 rounded-sm border border-white/15"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <a
                    href={explorerAddress(agent.owner)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-foreground transition-colors hover:text-accent-life"
                  >
                    {shortAddress(agent.owner)}
                  </a>
                  <ArrowUpRight size={11} className="text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/breed?parentA=${agent.id.toString()}`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500"
              >
                Breed with this agent
                <ArrowRight size={14} weight="bold" />
              </Link>
              {isOwner && !agent.name && (
                <SetNameButton
                  agentId={agent.id}
                  onSuccess={() => refetch()}
                />
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Reputation"
          value={formatScore(agent.score)}
          icon={<Trophy size={14} weight="bold" />}
        />
        <StatCard label="Rounds played" value={agent.rounds.toString()} />
        <StatCard label="Average score" value={formatScore(averageScore)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lineage */}
        <Panel>
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
              <GitFork size={12} weight="bold" />
              Lineage
            </div>
            {isGenesis ? (
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground">Genesis seed.</span> No
                parents — this agent was authored from scratch and minted by
                the deployer wallet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <ParentTile id={agent.parentA} label="Parent A" />
                <ParentTile id={agent.parentB} label="Parent B" />
              </div>
            )}
          </div>
        </Panel>

        {/* Memory */}
        <Panel>
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                Memory shards
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {shards.length} of {agent.rounds.toString() === "0" ? "0" : "…"}
              </span>
            </div>
            {shards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No memory recorded yet. Lessons accumulate after every round
                this agent participates in.
              </p>
            ) : (
              <ul className="divide-y divide-white/10">
                {shards.map((hash, i) => (
                  <li
                    key={`${hash}-${i}`}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">
                      shard {shards.length - i}
                    </span>
                    <span className="font-mono text-foreground">
                      {shortHash(hash, 8, 6)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {/* Genome anchor */}
      <Panel>
        <div className="p-6">
          <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-white/55">
            Genome anchor
          </div>
          <dl className="grid gap-y-3 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="text-muted-foreground">Root hash</dt>
            <dd className="break-all font-mono text-foreground">
              {agent.rootHash}
            </dd>

            <dt className="text-muted-foreground">Storage backend</dt>
            <dd className="text-foreground">
              0G Storage — encrypted shards, root hashed for tamper-evident
              integrity
            </dd>

            <dt className="text-muted-foreground">AgentGenome contract</dt>
            <dd className="font-mono">
              <a
                href={explorerAddress(ADDRESSES.agentGenome)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-accent-life"
              >
                {ADDRESSES.agentGenome}
                <ArrowUpRight size={11} />
              </a>
            </dd>

            <dt className="text-muted-foreground">Token URI</dt>
            <dd className="font-mono text-foreground">
              {`progena://agent/${agent.id.toString()}`}
            </dd>
          </dl>
        </div>
      </Panel>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-2 p-6">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55">
          {icon}
          {label}
        </span>
        <span className="font-display text-4xl font-light tracking-tight text-foreground tabular-nums">
          {value}
        </span>
      </div>
    </Panel>
  );
}

function ParentTile({ id, label }: { id: bigint; label: string }) {
  return (
    <Link
      href={`/agents/${id.toString()}`}
      className="group flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="font-mono text-sm text-foreground">
          #{id.toString()}
        </div>
      </div>
      <ArrowUpRight
        size={14}
        weight="bold"
        className="text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </Link>
  );
}
