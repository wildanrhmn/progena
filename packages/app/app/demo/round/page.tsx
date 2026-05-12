"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, Lightning } from "@phosphor-icons/react";
import { type Address } from "viem";
import { Panel } from "@/components/ui/panel";
import { ShardModal } from "@/components/agent/shard-modal";
import { EnterRoundDialog } from "@/components/round/enter-round-dialog";
import {
  CINEMATIC_EASE,
  CommittedAgents,
  OracleResearchPanel,
  ResolvedSummaryPanel,
  RevealStatusPanel,
  RoundAnchors,
  RoundCountdown,
  RoundHero,
  RoundPhaseTrack,
  YourTurnPanel,
  type CommittedAgentView,
} from "@/components/round/round-detail-cinematic";
import { ADDRESSES } from "@/lib/chain";
import type { RoundData, RoundStatus } from "@/hooks/use-rounds";
import type { RoundLifecycle, RoundLifecyclePhase } from "@/hooks/use-round-lifecycle";
import type { AgentRow } from "@/hooks/use-agents";
import type { MemoryShard } from "@/hooks/use-shard";

type DemoPhase =
  | "awaiting-commits"
  | "commits-closing"
  | "awaiting-reveals"
  | "reveals-closing"
  | "awaiting-oracle"
  | "resolved";

const PHASE_DEFS: Array<{ id: DemoPhase; label: string }> = [
  { id: "awaiting-commits", label: "Open · entries" },
  { id: "commits-closing", label: "Last call" },
  { id: "awaiting-reveals", label: "Sealing" },
  { id: "reveals-closing", label: "Finalizing reveals" },
  { id: "awaiting-oracle", label: "Truth-finding" },
  { id: "resolved", label: "Resolved" },
];

function buildSyntheticRound(phase: DemoPhase): RoundData {
  const now = Math.floor(Date.now() / 1000);
  const id = 9999n;
  const questionHash =
    "0xa1f24c8b2e9d4a1c5f7b6e8d9c0a1b2c3d4e5f6071829304a1b2c3d4e5f60718" as `0x${string}`;
  const entryFee = 100000000000000000n;
  const totalPool = 600000000000000000n;

  const base = {
    id,
    questionHash,
    entryFee,
    totalPool,
    status: "Open" as RoundStatus,
  };
  switch (phase) {
    case "awaiting-commits":
      return {
        ...base,
        commitDeadline: BigInt(now + 5 * 60),
        revealDeadline: BigInt(now + 10 * 60),
        outcome: 0,
        resolved: false,
        totalCommitted: 2n,
        totalRevealed: 0n,
      };
    case "commits-closing":
      return {
        ...base,
        commitDeadline: BigInt(now + 22),
        revealDeadline: BigInt(now + 5 * 60),
        outcome: 0,
        resolved: false,
        totalCommitted: 4n,
        totalRevealed: 0n,
      };
    case "awaiting-reveals":
      return {
        ...base,
        commitDeadline: BigInt(now - 60),
        revealDeadline: BigInt(now + 5 * 60),
        outcome: 0,
        resolved: false,
        totalCommitted: 5n,
        totalRevealed: 2n,
        status: "RevealPhase",
      };
    case "reveals-closing":
      return {
        ...base,
        commitDeadline: BigInt(now - 5 * 60),
        revealDeadline: BigInt(now + 18),
        outcome: 0,
        resolved: false,
        totalCommitted: 5n,
        totalRevealed: 4n,
        status: "RevealPhase",
      };
    case "awaiting-oracle":
      return {
        ...base,
        commitDeadline: BigInt(now - 10 * 60),
        revealDeadline: BigInt(now - 45),
        outcome: 0,
        resolved: false,
        totalCommitted: 5n,
        totalRevealed: 5n,
        status: "Closed",
      };
    case "resolved":
      return {
        ...base,
        commitDeadline: BigInt(now - 20 * 60),
        revealDeadline: BigInt(now - 10 * 60),
        outcome: 10000,
        resolved: true,
        totalCommitted: 5n,
        totalRevealed: 5n,
        status: "Resolved",
      };
  }
}

function syntheticLifecycle(phase: DemoPhase, round: RoundData): RoundLifecycle {
  const now = Math.floor(Date.now() / 1000);
  const phaseId: RoundLifecyclePhase =
    phase === "commits-closing"
      ? "commits-closing"
      : phase === "awaiting-commits"
        ? "awaiting-commits"
        : phase === "awaiting-reveals"
          ? "awaiting-reveals"
          : phase === "reveals-closing"
            ? "reveals-closing"
            : phase === "awaiting-oracle"
              ? "awaiting-oracle"
              : "resolved";

  const target =
    phase === "awaiting-commits" || phase === "commits-closing"
      ? Number(round.commitDeadline)
      : phase === "awaiting-reveals" || phase === "reveals-closing"
        ? Number(round.revealDeadline)
        : 0;
  const remaining = Math.max(0, target - now);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return {
    phase: phaseId,
    countdownSeconds: remaining,
    countdownLabel: `${m}:${String(s).padStart(2, "0")}`,
    daemonActive: false,
    headline:
      phase === "awaiting-oracle"
        ? `reveal closed ${Math.floor((now - Number(round.revealDeadline)) / 60)}m${Math.abs((now - Number(round.revealDeadline)) % 60)}s ago`
        : "",
    detail: "",
  };
}

const DEMO_VIEWER: Address = "0x4f4e5a4f4e5a4f4e5a4f4e5a4f4e5a4f4e5a4f4e";

const DEMO_OWNED_AGENTS: AgentRow[] = [
  {
    id: 2n,
    name: "Beta",
    rootHash: ("0x" + "00".repeat(32)) as `0x${string}`,
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
    rootHash: ("0x" + "00".repeat(32)) as `0x${string}`,
    parentA: 4n,
    parentB: 2n,
    bornAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    generation: 1,
    owner: DEMO_VIEWER,
    score: 9700n,
    rounds: 1n,
  },
];

function buildCommittedViews(phase: DemoPhase): CommittedAgentView[] {
  const allRevealed = phase === "awaiting-oracle" || phase === "resolved";
  const partial = phase === "awaiting-reveals" || phase === "reveals-closing";

  const seeds: Array<{
    id: bigint;
    name: string;
    generation: number;
    owner: `0x${string}`;
    isYou?: boolean;
    commitHash: `0x${string}`;
    predictionBps: number;
  }> = [
    {
      id: 1n,
      name: "Alpha",
      generation: 0,
      owner: "0xaa11aa11aa11aa11aa11aa11aa11aa11aa11aa11",
      commitHash:
        "0x9b1f4a3e2c7d8e6f0a5b1c9d3e2f7a8b4c5d6e7f8090a1b2c3d4e5f6071829ab",
      predictionBps: 9800,
    },
    {
      id: 2n,
      name: "Beta",
      generation: 0,
      owner: DEMO_VIEWER,
      isYou: true,
      commitHash:
        "0xa1b2c3d4e5f6071829304a1b2c3d4e5f6071829304a1b2c3d4e5f6071829abcd",
      predictionBps: 9700,
    },
    {
      id: 3n,
      name: "Gamma",
      generation: 0,
      owner: "0xcc33cc33cc33cc33cc33cc33cc33cc33cc33cc33",
      commitHash:
        "0xfedc0987654321fedc0987654321fedc0987654321fedc0987654321fedcba98",
      predictionBps: 8500,
    },
    {
      id: 4n,
      name: "Delta",
      generation: 0,
      owner: "0xdd44dd44dd44dd44dd44dd44dd44dd44dd44dd44",
      commitHash:
        "0x4444777722225555888811116666cccc9999dddd1212babacafe54321789abcd",
      predictionBps: 6700,
    },
    {
      id: 5n,
      name: "Delta·Beta-child",
      generation: 1,
      owner: DEMO_VIEWER,
      isYou: true,
      commitHash:
        "0x5555888899990000aaaa11112222333344445566778899abcdef00112233aabb",
      predictionBps: 9200,
    },
  ];

  const limit =
    phase === "awaiting-commits" ? 2 : phase === "commits-closing" ? 4 : 5;
  return seeds.slice(0, limit).map((s, i) => {
    const revealed =
      allRevealed || (partial && i < (phase === "reveals-closing" ? 4 : 2));
    const outcome = 10000;
    const distance = Math.abs(s.predictionBps - outcome);
    return {
      id: s.id,
      name: s.name,
      generation: s.generation,
      owner: s.owner,
      ownerShort: `${s.owner.slice(0, 6)}…${s.owner.slice(-4)}`,
      isYou: s.isYou,
      state: revealed ? "revealed" : "sealed",
      commitHash: s.commitHash,
      predictionBps: revealed ? s.predictionBps : undefined,
      scoreDeltaBps:
        revealed && phase === "resolved" ? 10000 - 2 * distance : undefined,
    };
  });
}

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
    "I'm Beta — methodical, evidence-first. My SOUL tells me to never anchor on round numbers without verification, and my earned-skill 'search-first-on-price-questions' reminds me to always pull current data before deciding.\n\nFor a question of the form 'will BTC be at or above $80k by <date>', the right first move is to check the actual current price and the recent trajectory. I should NOT assume a value based on training-era knowledge — crypto moves fast.\n\nIf current price is already meaningfully above the threshold and there's no obvious catalyst that could halve it before resolution, the prediction should be close to 10000 (certain YES).",
  reasoningPreview:
    "Pulled current BTC price via fetch_token_price → $91,200. Cross-checked with web_search for any imminent regulatory or macro catalyst → none found. Threshold $80k is ~12% below current; even a sharp drawdown leaves headroom. Anchoring at 9700.",
  toolCalls: [
    {
      tool: "fetch_token_price",
      args: { symbol: "BTC" },
      summary:
        "BTC = $91,237.42 (CoinGecko, 24h Δ +1.8%). Threshold $80,000 is 12.4% below current price.",
      ok: true,
      durationMs: 318,
    },
    {
      tool: "web_search",
      args: { query: "BTC price catalyst 2026-05-12" },
      summary:
        "No major regulatory or macro events flagged for resolution window. Mainstream coverage focuses on continued ETF inflows.",
      ok: true,
      durationMs: 1247,
    },
    {
      tool: "fetch_market_state",
      args: { roundId: 8 },
      summary:
        "Round 8 entryFee 0.1 OG, totalPool 0.5 OG, 5 agents committed.",
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
  const lifecycle = useMemo(() => syntheticLifecycle(phase, round), [phase, round]);
  const committed = useMemo(() => buildCommittedViews(phase), [phase]);

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
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent-life/80">
            <Lightning size={11} weight="fill" />
            Design preview · synthetic data
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Round detail · v2
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Step through each phase below. The countdown and oracle animation
            tick live within each phase; the production page transitions
            between phases automatically as deadlines pass.
          </p>
        </div>
      </Panel>

      <Panel>
        <div className="p-5">
          <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/65">
            Step through phases
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
        </div>
      </Panel>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.55, ease: CINEMATIC_EASE }}
          className="space-y-6"
        >
          <RoundHero
            round={round}
            question="Will BTC be at or above $80,000 by 2026-05-13 00:00 UTC?"
            phase={lifecycle.phase}
          />

          <Panel>
            <div className="p-6 sm:p-7">
              <RoundCountdown
                lifecycle={lifecycle}
                outcomeBps={round.outcome}
              />
            </div>
          </Panel>

          <RoundPhaseTrack phase={lifecycle.phase} />

          {(phase === "awaiting-commits" || phase === "commits-closing") && (
            <YourTurnPanel
              entryFee={round.entryFee}
              urgent={phase === "commits-closing"}
              ownedCount={DEMO_OWNED_AGENTS.length}
              onEnter={() => setEnterOpen(true)}
            />
          )}
          {(phase === "awaiting-reveals" || phase === "reveals-closing") && (
            <RevealStatusPanel
              revealed={Number(round.totalRevealed)}
              total={Number(round.totalCommitted)}
              urgent={phase === "reveals-closing"}
            />
          )}
          {phase === "awaiting-oracle" && <OracleResearchPanel />}
          {phase === "resolved" && (
            <ResolvedSummaryPanel yourAgents={[]} />
          )}

          <CommittedAgents agents={committed} phase={lifecycle.phase} />

          {phase === "resolved" && (
            <Panel>
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/65">
                      Memory shard · preview
                    </div>
                    <p className="text-sm text-foreground">
                      Open the shard modal to see what an agent's memory shard
                      looks like.
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
          )}

          <RoundAnchors
            round={round}
            predictionRoundAddress={ADDRESSES.predictionRound}
            roundMetadataAddress={ADDRESSES.roundMetadata}
          />
        </motion.div>
      </AnimatePresence>

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
