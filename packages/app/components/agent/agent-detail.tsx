"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import makeBlockie from "ethereum-blockies-base64";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Brain,
  CircleNotch,
  GitBranch,
  GitFork,
  Lightning,
  Sparkle,
  Trophy,
  Wrench,
} from "@phosphor-icons/react";
import { useAgent, useAgentMemoryShards } from "@/hooks/use-agent";
import { displayNameOf } from "@/hooks/use-agents";
import { useNames, nameOrId } from "@/hooks/use-names";
import { useDescendants } from "@/hooks/use-descendants";
import { useTraits } from "@/hooks/use-traits";
import { useEarnedSkills } from "@/hooks/use-earned-skills";
import { Panel, BracketBox } from "@/components/ui/panel";
import { SetNameButton } from "./set-name-dialog";
import { ShardModal } from "./shard-modal";
import { StudFeePanel } from "./stud-fee-panel";
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

type Props = { agentId: bigint };

export function AgentDetail({ agentId }: Props) {
  const { agent, averageScore, isFinalized, isLoading, error, refetch } =
    useAgent(agentId);
  const { shards, count: shardCount } = useAgentMemoryShards(agentId, 12);
  const { descendants } = useDescendants(agentId);
  const { traits } = useTraits(agentId);
  const { skills: earnedSkills } = useEarnedSkills(agentId);
  const { authenticated, user } = usePrivy();
  const [openShard, setOpenShard] = useState<{ hash: string; index: number } | undefined>();

  const lineageIds = agent
    ? [agent.parentA, agent.parentB, ...descendants.map((d) => d.otherParent)]
    : [];
  const names = useNames(lineageIds);

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

  const viewer = authenticated ? user?.wallet?.address : undefined;
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
        <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-[auto_1fr] md:gap-12">
          <BracketBox className="flex h-64 w-64 items-center justify-center p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sigil}
              alt=""
              className="h-48 w-48 rounded-sm border border-white/15"
              style={{ imageRendering: "pixelated" }}
            />
          </BracketBox>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
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
                  Awaiting genome
                </span>
              )}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                Token #{agent.id.toString()}
              </span>
            </div>

            <h1 className="mt-4 text-balance font-display text-6xl tracking-tight text-foreground sm:text-7xl">
              {agent.name ? (
                agent.name
              ) : (
                <span className="italic text-muted-foreground">unnamed</span>
              )}
            </h1>

            <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/40">
                  Born
                </span>
                <div className="mt-1 text-foreground">
                  {formatTimestamp(agent.bornAt)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRelative(agent.bornAt)}
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/40">
                  Owner
                </span>
                <div className="mt-1 flex items-center gap-2">
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
                {isOwner && (
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-accent-life">
                    you
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/breed?parentA=${agent.id.toString()}`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500"
              >
                Breed with this agent
                <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          </div>
        </div>
      </Panel>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Reputation"
          value={formatScore(agent.score)}
          icon={<Trophy size={11} weight="bold" />}
        />
        <StatCard label="Rounds played" value={agent.rounds.toString()} />
        <StatCard label="Average score" value={formatScore(averageScore)} />
        <StatCard
          label="Descendants"
          value={descendants.length.toString()}
          icon={<GitBranch size={11} weight="bold" />}
        />
      </div>

      {/* Capabilities */}
      <Panel>
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
            <Brain size={12} weight="bold" />
            Capabilities
          </div>
          {!traits && earnedSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No public capabilities yet. The runtime daemon publishes
              inherited + synthesized capabilities to AgentMetadata after every
              finalize, and earned skills accumulate as the agent plays rounds.
            </p>
          ) : (
            <div className="space-y-5">
              {traits && traits.skills.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/55">
                    <Lightning size={11} weight="bold" />
                    Inherited + synthesized at birth
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {traits.skills.map((s) => {
                      const isHybrid =
                        traits.hybridSkillName !== undefined &&
                        s === traits.hybridSkillName;
                      return (
                        <span
                          key={s}
                          title={
                            isHybrid && traits.hybridSourceSkills
                              ? `Synthesized at birth via 0G Compute from "${traits.hybridSourceSkills[0]}" + "${traits.hybridSourceSkills[1]}"`
                              : undefined
                          }
                          className={
                            isHybrid
                              ? "inline-flex items-center gap-1 rounded-full border border-accent-lineage/50 bg-accent-lineage/15 px-2.5 py-1 text-[11px] uppercase tracking-wider text-accent-lineage"
                              : "rounded-full border border-accent-life/40 bg-accent-life/10 px-2.5 py-1 text-[11px] uppercase tracking-wider text-accent-life"
                          }
                        >
                          {isHybrid && <Sparkle size={9} weight="fill" />}
                          {s}
                        </span>
                      );
                    })}
                  </div>
                  {traits.hybridSkillName && traits.hybridSourceSkills && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      <span className="text-accent-lineage">{traits.hybridSkillName}</span>{" "}
                      was synthesized by 0G Compute at breed time from{" "}
                      <span className="font-mono">{traits.hybridSourceSkills[0]}</span> +{" "}
                      <span className="font-mono">{traits.hybridSourceSkills[1]}</span>.
                    </p>
                  )}
                </div>
              )}
              {earnedSkills.length > 0 && (
                <EarnedSkillsSection skills={earnedSkills} />
              )}
              {traits && traits.tools.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/55">
                    <Wrench size={11} weight="bold" />
                    Tools
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {traits.tools.map((t) => {
                      const isSynth =
                        traits.synthesizedToolName !== undefined &&
                        t === traits.synthesizedToolName;
                      return (
                        <span
                          key={t}
                          title={
                            isSynth && traits.synthesizedToolSourceTools
                              ? `Synthesized at birth via 0G Compute from ${traits.synthesizedToolSourceTools.join(", ")}`
                              : undefined
                          }
                          className={
                            isSynth
                              ? "inline-flex items-center gap-1 rounded-full border border-accent-lineage/50 bg-accent-lineage/15 px-2.5 py-1 text-[11px] text-accent-lineage"
                              : "rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-300"
                          }
                        >
                          {isSynth && <Sparkle size={9} weight="fill" />}
                          {t}
                        </span>
                      );
                    })}
                  </div>
                  {traits.synthesizedToolName && traits.synthesizedToolSourceTools && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      <span className="text-accent-lineage">{traits.synthesizedToolName}</span>{" "}
                      was synthesized by 0G Compute at breed time from{" "}
                      <span className="font-mono">{traits.synthesizedToolSourceTools.join(", ")}</span>.
                    </p>
                  )}
                </div>
              )}
              {traits && traits.soulPreview && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/55">
                    <span>SOUL preview</span>
                    {traits.synthesizedSoul && (
                      <span
                        title="Synthesized at birth by 0G Compute from both parents' SOULs"
                        className="inline-flex items-center gap-1 rounded-full border border-accent-lineage/40 bg-accent-lineage/10 px-1.5 py-0.5 text-[9px] tracking-wider text-accent-lineage"
                      >
                        <Sparkle size={8} weight="fill" />
                        AI-synthesized
                      </span>
                    )}
                  </div>
                  <blockquote className="border-l-2 border-accent-lineage/60 pl-3 text-sm italic leading-relaxed text-foreground/85">
                    {traits.soulPreview}
                    {traits.soulPreview.length >= 320 && "…"}
                  </blockquote>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Lineage + Memory */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
              <GitFork size={12} weight="bold" />
              Lineage
            </div>
            {isGenesis ? (
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground">Genesis seed.</span> No
                parents — this agent was authored from scratch and minted as
                generation zero.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <ParentTile id={agent.parentA} label="Parent A" name={names.get(agent.parentA.toString())} />
                <ParentTile id={agent.parentB} label="Parent B" name={names.get(agent.parentB.toString())} />
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                <Sparkle size={11} weight="bold" />
                Memory shards
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {shardCount.toString()} total
              </span>
            </div>
            {shards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No memory recorded yet. Lessons accumulate after every round
                this agent participates in, indexed on the AgentMemory contract
                and stored on 0G.
              </p>
            ) : (
              <ul className="divide-y divide-white/10">
                {shards.map((hash, i) => {
                  const shardNum = Number(shardCount) - i;
                  return (
                    <li key={`${hash}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setOpenShard({ hash, index: shardNum })}
                        title="Open shard — fetched from 0G Storage"
                        className="group flex w-full items-center justify-between gap-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.02]"
                      >
                        <span className="font-mono text-muted-foreground">
                          shard {shardNum}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-foreground transition-colors group-hover:text-accent-lineage">
                          {shortHash(hash, 8, 6)}
                          <ArrowUpRight
                            size={10}
                            weight="bold"
                            className="text-muted-foreground transition-colors group-hover:text-accent-lineage"
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {/* Descendants */}
      <Panel>
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
              <GitBranch size={12} weight="bold" />
              Descendants
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {descendants.length} bred
            </span>
          </div>
          {descendants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No descendants yet. When others breed with this agent, the
              children show up here and earn{" "}
              {agent.name ?? `#${agent.id.toString()}`} a perpetual royalty cut
              via the on-chain pull-payment splitter.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {descendants.map((d) => (
                <li key={d.id.toString()}>
                  <Link
                    href={`/agents/${d.id.toString()}`}
                    className="group flex items-center justify-between py-3 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-accent-lineage/40 bg-accent-lineage/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-lineage">
                        Gen {d.generation}
                      </span>
                      <div>
                        <div className="text-sm text-foreground">
                          {nameOrId(d.id, names)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          bred with {nameOrId(d.otherParent, names)} ·{" "}
                          {formatRelative(d.bornAt)}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight
                      size={14}
                      weight="bold"
                      className="text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* Owner / Stud */}
      <Panel>
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <StudFeePanel agentId={agent.id} isOwner={isOwner} />
          <div className="flex items-center justify-between gap-4 md:border-l md:border-white/10 md:pl-6">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
                Name
              </div>
              {agent.name ? (
                <div className="font-display text-2xl text-foreground">
                  {agent.name}
                  <span className="ml-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Claimed
                  </span>
                </div>
              ) : (
                <div className="font-display text-2xl italic text-muted-foreground">
                  unclaimed
                </div>
              )}
            </div>
            {isOwner && !agent.name && (
              <SetNameButton
                agentId={agent.id}
                onSuccess={() => refetch()}
              />
            )}
          </div>
        </div>
      </Panel>

      <ShardModal
        open={!!openShard}
        rootHash={openShard?.hash}
        shardIndex={openShard?.index}
        onClose={() => setOpenShard(undefined)}
      />

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

function ParentTile({
  id,
  label,
  name,
}: {
  id: bigint;
  label: string;
  name: string | undefined;
}) {
  return (
    <Link
      href={`/agents/${id.toString()}`}
      className="group flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm text-foreground">
          {name ?? <span className="font-mono">#{id.toString()}</span>}
        </div>
        {name && (
          <div className="font-mono text-[10px] text-muted-foreground">
            #{id.toString()}
          </div>
        )}
      </div>
      <ArrowUpRight
        size={14}
        weight="bold"
        className="text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </Link>
  );
}

type EarnedSkill = ReturnType<typeof useEarnedSkills>["skills"][number];

function EarnedSkillsSection({ skills }: { skills: EarnedSkill[] }) {
  const [allOpen, setAllOpen] = useState(false);
  const sorted = [...skills].sort((a, b) =>
    Number(b.earnedInRound - a.earnedInRound)
  );
  const visible = sorted.slice(0, 3);
  const hidden = sorted.slice(3);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/65">
          <Trophy size={12} weight="bold" className="text-amber-300" />
          Earned in rounds · {skills.length}
        </div>
        {hidden.length > 0 && (
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all {skills.length}
            <ArrowUpRight size={11} weight="bold" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {visible.map((s) => (
          <EarnedSkillRow key={s.skillName} skill={s} />
        ))}
      </div>
      {hidden.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          + {hidden.length} more — click View all to see every earned skill.
        </p>
      )}
      {!skills[0]?.reasoning ? null : (
        <p className="mt-2 text-xs text-muted-foreground">
          Earned by demonstrating a coherent pattern across multiple rounds.
          Skill stored on 0G Storage, anchored on AgentMetadata.
        </p>
      )}
      <AllEarnedSkillsModal
        open={allOpen}
        skills={sorted}
        onClose={() => setAllOpen(false)}
      />
    </div>
  );
}

function EarnedSkillRow({ skill }: { skill: EarnedSkill }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-900/10 px-3 py-2">
      <Trophy
        size={12}
        weight="fill"
        className="mt-0.5 shrink-0 text-amber-300"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-wider text-amber-200">
          <span>{skill.skillName}</span>
          <Link
            href={`/rounds/${skill.earnedInRound.toString()}`}
            className="font-mono normal-case tracking-normal text-amber-300/70 hover:text-amber-200"
          >
            · round #{skill.earnedInRound.toString()}
          </Link>
        </div>
        {skill.reasoning && (
          <p className="mt-1 text-xs leading-snug text-amber-100/80">
            {skill.reasoning}
          </p>
        )}
      </div>
    </div>
  );
}

function AllEarnedSkillsModal({
  open,
  skills,
  onClose,
}: {
  open: boolean;
  skills: EarnedSkill[];
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-10">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative max-h-[calc(100vh-5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-amber-300/80">
              Every earned skill
            </div>
            <h3 className="font-display text-xl tracking-tight text-foreground">
              {skills.length} skills · earned in rounds
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {skills.map((s) => (
            <EarnedSkillRow key={s.skillName} skill={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
