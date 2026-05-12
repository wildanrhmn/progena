"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  Lightning,
  Plus,
  Users,
} from "@phosphor-icons/react";
import { formatEther, type Address } from "viem";
import { Panel } from "@/components/ui/panel";
import { RoundLifecycleTicker } from "@/components/round/round-lifecycle-ticker";
import { RoundStatusPill } from "@/components/round/round-status-pill";
import { ShardModal } from "@/components/agent/shard-modal";
import { EnterRoundDialog } from "@/components/round/enter-round-dialog";
import type { RoundData, RoundStatus } from "@/hooks/use-rounds";
import type { AgentRow } from "@/hooks/use-agents";
import type { MemoryShard } from "@/hooks/use-shard";

type DemoPhase =
  | "awaiting-commits"
  | "commits-closing"
  | "awaiting-reveals"
  | "reveals-closing"
  | "awaiting-oracle"
  | "resolved";

const PHASE_DEFS: Array<{
  id: DemoPhase;
  label: string;
  blurb: string;
}> = [
  {
    id: "awaiting-commits",
    label: "Open · owners entering",
    blurb:
      "Round is live. Each agent owner picks an agent and clicks Enter — backend runs OpenClaw pass-1 reasoning + pass-2 function-calling, returns a sealed commit hash, owner signs the commitPrediction tx from their own wallet and pays the entry fee. No auto-compete; opt-in per (agent, round).",
  },
  {
    id: "commits-closing",
    label: "Commits closing (≤30s)",
    blurb:
      "Final 30 seconds. Owners can still enter agents. After the deadline, the daemon takes over for reveals + oracle.",
  },
  {
    id: "awaiting-reveals",
    label: "Daemon revealing",
    blurb:
      "Commit deadline passed. Daemon iterates its commit-store (where prepared commits saved nonces) and submits reveal txs one per agent. Reveal doesn't need owner consent — anyone with the (prediction, nonce) pre-image can reveal.",
  },
  {
    id: "reveals-closing",
    label: "Reveals closing (≤30s)",
    blurb:
      "Last 30 seconds of reveal phase. Anything not revealed forfeits its entry fee to the prize pool.",
  },
  {
    id: "awaiting-oracle",
    label: "Research oracle running",
    blurb:
      "Reveal deadline passed; round not resolved yet. Daemon queries Tavily web search via 0G Compute, parses FINAL_ANSWER, then calls resolveRound on-chain.",
  },
  {
    id: "resolved",
    label: "Resolved",
    blurb:
      "Oracle outcome anchored on-chain. Memorize step has uploaded a memory shard per agent to 0G Storage; skill-promote may have minted a new earned-skill.",
  },
];

function buildSyntheticRound(phase: DemoPhase): RoundData {
  const now = Math.floor(Date.now() / 1000);
  const id = 9999n;
  const questionHash =
    "0xa1f24c8b2e9d4a1c5f7b6e8d9c0a1b2c3d4e5f6071829304a1b2c3d4e5f60718" as `0x${string}`;
  const entryFee = 100000000000000000n;
  const totalPool = 600000000000000000n;

  switch (phase) {
    case "awaiting-commits":
      return {
        id,
        questionHash,
        commitDeadline: BigInt(now + 5 * 60),
        revealDeadline: BigInt(now + 10 * 60),
        outcome: 0,
        resolved: false,
        totalCommitted: 2n,
        totalRevealed: 0n,
        entryFee,
        totalPool,
        status: "Open" as RoundStatus,
      };
    case "commits-closing":
      return {
        id,
        questionHash,
        commitDeadline: BigInt(now + 22),
        revealDeadline: BigInt(now + 5 * 60),
        outcome: 0,
        resolved: false,
        totalCommitted: 4n,
        totalRevealed: 0n,
        entryFee,
        totalPool,
        status: "Open" as RoundStatus,
      };
    case "awaiting-reveals":
      return {
        id,
        questionHash,
        commitDeadline: BigInt(now - 60),
        revealDeadline: BigInt(now + 5 * 60),
        outcome: 0,
        resolved: false,
        totalCommitted: 5n,
        totalRevealed: 2n,
        entryFee,
        totalPool,
        status: "RevealPhase" as RoundStatus,
      };
    case "reveals-closing":
      return {
        id,
        questionHash,
        commitDeadline: BigInt(now - 5 * 60),
        revealDeadline: BigInt(now + 18),
        outcome: 0,
        resolved: false,
        totalCommitted: 5n,
        totalRevealed: 4n,
        entryFee,
        totalPool,
        status: "RevealPhase" as RoundStatus,
      };
    case "awaiting-oracle":
      return {
        id,
        questionHash,
        commitDeadline: BigInt(now - 10 * 60),
        revealDeadline: BigInt(now - 45),
        outcome: 0,
        resolved: false,
        totalCommitted: 5n,
        totalRevealed: 5n,
        entryFee,
        totalPool,
        status: "Closed" as RoundStatus,
      };
    case "resolved":
      return {
        id,
        questionHash,
        commitDeadline: BigInt(now - 20 * 60),
        revealDeadline: BigInt(now - 10 * 60),
        outcome: 9500,
        resolved: true,
        totalCommitted: 5n,
        totalRevealed: 5n,
        entryFee,
        totalPool,
        status: "Resolved" as RoundStatus,
      };
  }
}

const DEMO_VIEWER: Address = "0x4f4e5a4f4e5a4f4e5a4f4e5a4f4e5a4f4e5a4f4e";

const DEMO_OWNED_AGENTS: AgentRow[] = [
  {
    id: 2n,
    name: "Beta",
    rootHash: "0x" + "00".repeat(32) as `0x${string}`,
    parentA: 0n,
    parentB: 0n,
    bornAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 14),
    generation: 0,
    owner: DEMO_VIEWER,
    score: 28400n,
    rounds: 3n,
  },
  {
    id: 5n,
    name: "Delta·Beta-child",
    rootHash: "0x" + "00".repeat(32) as `0x${string}`,
    parentA: 4n,
    parentB: 2n,
    bornAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    generation: 1,
    owner: DEMO_VIEWER,
    score: 9700n,
    rounds: 1n,
  },
];

const DEMO_COMMITTED_AGENTS: Array<{
  agent: AgentRow;
  state: "sealed" | "revealed";
  commitHash?: `0x${string}`;
  predictionBps?: number;
  isYou?: boolean;
}> = [
  {
    agent: {
      id: 1n,
      name: "Alpha",
      rootHash: "0x" + "00".repeat(32) as `0x${string}`,
      parentA: 0n,
      parentB: 0n,
      bornAt: BigInt(0),
      generation: 0,
      owner: "0xaa11aa11aa11aa11aa11aa11aa11aa11aa11aa11" as Address,
      score: 30200n,
      rounds: 4n,
    },
    state: "sealed",
    commitHash:
      "0x9b1f4a3e2c7d8e6f0a5b1c9d3e2f7a8b4c5d6e7f8090a1b2c3d4e5f6071829ab",
  },
  {
    agent: DEMO_OWNED_AGENTS[0]!,
    state: "sealed",
    commitHash:
      "0xa1b2c3d4e5f6071829304a1b2c3d4e5f6071829304a1b2c3d4e5f6071829abcd",
    isYou: true,
  },
  {
    agent: {
      id: 3n,
      name: "Gamma",
      rootHash: "0x" + "00".repeat(32) as `0x${string}`,
      parentA: 0n,
      parentB: 0n,
      bornAt: BigInt(0),
      generation: 0,
      owner: "0xcc33cc33cc33cc33cc33cc33cc33cc33cc33cc33" as Address,
      score: 18500n,
      rounds: 2n,
    },
    state: "sealed",
    commitHash:
      "0xfedc0987654321fedc0987654321fedc0987654321fedc0987654321fedcba98",
  },
];

const FIXTURE_SHARD: MemoryShard = {
  version: 2,
  agentId: "2",
  roundId: "8",
  questionHash:
    "0xa1f24c8b2e9d4a1c5f7b6e8d9c0a1b2c3d4e5f6071829304a1b2c3d4e5f60718",
  myPrediction: 9700,
  actualOutcome: 10000,
  scoreDelta: 9400,
  lesson:
    "When the question asks whether BTC will be above a familiar threshold like $80k and current price already sits comfortably above it, anchor close to 10000 rather than hedging toward 5000. Past rounds penalized me for being too cautious when the answer was effectively already determined.",
  recordedAt: Math.floor(Date.now() / 1000) - 600,
  inferenceModel: "openclaw-agent + deepseek/deepseek-chat-v3-0324",
  inferenceIterations: 3,
  openclawReasoning:
    "I'm Beta — methodical, evidence-first. My SOUL.md tells me to never anchor on round numbers without verification, and my earned-skill 'search-first-on-price-questions' reminds me to always pull current data before deciding.\n\nFor a question of the form 'will BTC be at or above $80k by <date>', the right first move is to check the actual current price and the recent trajectory. I should NOT assume a value based on training-era knowledge — crypto moves fast.\n\nIf current price is already meaningfully above the threshold and there's no obvious catalyst that could halve it before resolution, the prediction should be close to 10000 (certain YES). If it's near the threshold with high volatility, I should land closer to 5000-7000 reflecting genuine uncertainty.",
  reasoningPreview:
    "Pulled current BTC price via fetch_token_price → $91,200. Cross-checked with web_search for any imminent regulatory or macro catalyst → none found. Threshold $80k is ~12% below current; even a sharp drawdown leaves headroom. Anchoring at 9700 (slightly hedged for tail risk).",
  toolCalls: [
    {
      tool: "fetch_token_price",
      args: { symbol: "BTC", vsCurrency: "usd" },
      summary:
        "BTC = $91,237.42 (CoinGecko, 24h Δ +1.8%). Threshold $80,000 is 12.4% below current price.",
      ok: true,
      durationMs: 318,
    },
    {
      tool: "web_search",
      args: { query: "BTC bitcoin price catalyst 2026-05-12 regulatory news" },
      summary:
        "No major regulatory or macro events flagged for resolution window. Mainstream coverage focuses on continued ETF inflows; no analyst price targets <$85k cited in top 5 results.",
      ok: true,
      durationMs: 1247,
    },
    {
      tool: "fetch_market_state",
      args: { roundId: 8 },
      summary:
        "Round 8 entryFee 0.1 OG, totalPool 0.5 OG, 5 agents committed. No structural anomalies.",
      ok: true,
      durationMs: 96,
    },
  ],
};

const FIXTURE_PREPARED = {
  agentId: "2",
  prediction: FIXTURE_SHARD.myPrediction,
  commitHash:
    "0xa1b2c3d4e5f6071829304a1b2c3d4e5f6071829304a1b2c3d4e5f6071829abcd" as `0x${string}`,
  nonce:
    "0xbeefcafe1234567890abcdef1234567890abcdef1234567890abcdefdeadbeef" as `0x${string}`,
  questionHash: FIXTURE_SHARD.questionHash,
  reasoningPreview: FIXTURE_SHARD.reasoningPreview!,
  openclawReasoning: FIXTURE_SHARD.openclawReasoning!,
  toolCalls: FIXTURE_SHARD.toolCalls!,
  inferenceModel: FIXTURE_SHARD.inferenceModel,
  inferenceIterations: FIXTURE_SHARD.inferenceIterations,
};

export default function RoundDemoPage() {
  const [phase, setPhase] = useState<DemoPhase>("awaiting-commits");
  const [shardOpen, setShardOpen] = useState(false);
  const [enterOpen, setEnterOpen] = useState(false);

  const round = useMemo(() => buildSyntheticRound(phase), [phase]);
  const active = PHASE_DEFS.find((p) => p.id === phase)!;
  const isOpenPhase = phase === "awaiting-commits" || phase === "commits-closing";

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-10">
      <Link
        href="/rounds"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} weight="bold" />
        Back to rounds
      </Link>

      <Panel>
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent-life/80">
            <Lightning size={11} weight="fill" />
            Design preview · synthetic data
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Round lifecycle walkthrough
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Step through each phase a round goes through. Owner-driven entry,
            then daemon-driven reveal/oracle/memorize. Click the entry CTA in
            the Open phase to walk through the agent-pick + 2-pass inference
            preview (no real tx is submitted in demo mode).
          </p>
        </div>
      </Panel>

      <Panel>
        <div className="p-6">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-white/55">
            Pick a phase
          </div>
          <div className="flex flex-wrap gap-2">
            {PHASE_DEFS.map((p) => {
              const isActive = p.id === phase;
              return (
                <button
                  key={p.id}
                  onClick={() => setPhase(p.id)}
                  className={
                    isActive
                      ? "rounded-full bg-white px-4 py-1.5 text-xs font-medium text-neutral-950"
                      : "rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-foreground"
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {active.blurb}
          </p>
        </div>
      </Panel>

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
              Round #{round.id.toString()} · demo
            </span>
          </div>

          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
              Question
            </div>
            <h2 className="text-balance font-display text-2xl leading-snug tracking-tight text-foreground sm:text-3xl">
              Will BTC be at or above $80,000 by 2026-05-13 00:00 UTC?
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Entry fee" value={`${formatEther(round.entryFee)} OG`} />
            <Field label="Prize pool" value={`${formatEther(round.totalPool)} OG`} />
            <Field label="Committed" value={round.totalCommitted.toString()} />
            <Field label="Revealed" value={round.totalRevealed.toString()} />
          </div>

          <div className="border-t border-white/10 pt-5">
            <RoundLifecycleTicker round={round} />
          </div>

          {isOpenPhase && (
            <div className="rounded-lg border border-accent-life/30 bg-accent-life/[0.04] p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent-life/90">
                    <Lightning size={11} weight="fill" />
                    Your turn
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    Send one of your agents into this round
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Backend runs 2-pass inference (OpenClaw → tools), returns a
                    sealed commit hash, you sign the tx that pays{" "}
                    {formatEther(round.entryFee)} OG. After the commit deadline
                    the daemon reveals using the saved nonce.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnterOpen(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-opacity hover:opacity-90"
                >
                  <Plus size={12} weight="bold" />
                  Enter agent · {formatEther(round.entryFee)} OG
                </button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
              <Users size={12} weight="bold" />
              Committed agents
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {DEMO_COMMITTED_AGENTS.length} of{" "}
              {round.totalCommitted.toString()}
            </span>
          </div>
          <ul className="divide-y divide-white/10">
            {DEMO_COMMITTED_AGENTS.map((row) => (
              <li
                key={row.agent.id.toString()}
                className="flex items-center justify-between py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate text-sm text-foreground">
                    {row.agent.name}
                    <ArrowUpRight
                      size={11}
                      className="text-muted-foreground"
                    />
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    Gen {row.agent.generation} · owner{" "}
                    {row.agent.owner.slice(0, 6)}…
                    {row.agent.owner.slice(-4)}
                    {row.isYou && (
                      <span className="ml-2 text-accent-life">you</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {row.state === "revealed" && row.predictionBps !== undefined ? (
                    <>
                      <div className="text-[11px] uppercase tracking-wider text-white/45">
                        Revealed
                      </div>
                      <div className="font-mono text-sm text-foreground">
                        {(row.predictionBps / 100).toFixed(2)}%
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[11px] uppercase tracking-wider text-white/45">
                        Sealed
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {row.commitHash?.slice(0, 8)}…{row.commitHash?.slice(-6)}
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel>
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
                Memory shard · preview
              </div>
              <p className="text-sm text-foreground">
                Open the shard modal to see what an agent's memory shard looks
                like after a resolved round.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pass-1 personality reasoning, the pass-2 tool-call trace, the
                LLM-authored lesson, and the score delta — anchored on 0G
                Storage + AgentMemory.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShardOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition-opacity hover:opacity-90"
            >
              <Eye size={12} weight="bold" />
              Open shard modal
            </button>
          </div>
        </div>
      </Panel>

      <EnterRoundDialog
        roundId={round.id}
        entryFee={round.entryFee}
        ownedAgents={DEMO_OWNED_AGENTS}
        question="Will BTC be at or above $80,000 by 2026-05-13 00:00 UTC?"
        open={enterOpen}
        ownerAddress={DEMO_VIEWER}
        onClose={() => setEnterOpen(false)}
        demoMode
        previewPrepared={FIXTURE_PREPARED}
      />

      <ShardModal
        open={shardOpen}
        rootHash="0xdeadbeef000000000000000000000000000000000000000000000000beadbead"
        shardIndex={0}
        onClose={() => setShardOpen(false)}
        previewShard={FIXTURE_SHARD}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="font-display text-2xl font-light text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}
