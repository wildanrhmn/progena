"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { type Address } from "viem";
import { ArrowLeft, CircleNotch } from "@phosphor-icons/react";
import {
  useRound,
  useRoundAgents,
  type RoundData,
} from "@/hooks/use-rounds";
import { useOwnedAgents } from "@/hooks/use-owned-agents";
import { useAgentRows } from "@/hooks/use-agents";
import { useRoundQuestion } from "@/hooks/use-round-question";
import { useRoundLifecycle } from "@/hooks/use-round-lifecycle";
import { useReadContracts } from "wagmi";
import { predictionRoundContract } from "@/lib/contracts";
import { ADDRESSES } from "@/lib/chain";
import { EnterRoundDialog } from "./enter-round-dialog";
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
} from "./round-detail-cinematic";
import { Panel } from "@/components/ui/panel";
import { motion } from "framer-motion";

type Props = { roundId: bigint };

export function RoundDetail({ roundId }: Props) {
  const { round, isLoading, error, refetch } = useRound(roundId);
  const { data: agentIdsRaw, refetch: refetchAgents } = useRoundAgents(roundId);
  const agentIds = useMemo<bigint[]>(
    () => ((agentIdsRaw as readonly bigint[] | undefined) ?? []).slice(),
    [agentIdsRaw]
  );
  const { agents: committedAgents } = useAgentRows(agentIds);
  const { text: question } = useRoundQuestion(roundId);

  const { authenticated, user } = usePrivy();
  const viewer = (
    authenticated ? user?.wallet?.address : undefined
  ) as Address | undefined;
  const { agents: ownedAgents } = useOwnedAgents(viewer);

  const lifecycle = useRoundLifecycle(round);

  const commitmentCalls = useMemo(
    () =>
      agentIds.map((id) => ({
        ...predictionRoundContract,
        functionName: "commitmentOf",
        args: [roundId, id] as const,
      })),
    [agentIds, roundId]
  );
  const { data: commitmentResults } = useReadContracts({
    contracts: commitmentCalls,
    allowFailure: true,
    query: {
      enabled: agentIds.length > 0,
      staleTime: 4_000,
      refetchInterval: 5_000,
    },
  });

  const [enterOpen, setEnterOpen] = useState(false);

  if (isLoading && !round) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          <CircleNotch size={14} className="mr-2 animate-spin" />
          Reading round #{roundId.toString()} from 0G mainnet…
        </div>
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-6">
          <div className="mb-1 text-sm font-medium text-foreground">
            Couldn't load round #{roundId.toString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {error?.message ?? "Round may not exist on this network."}
          </p>
        </div>
      </div>
    );
  }

  const committedViews = buildCommittedViews({
    round,
    agentIds,
    rows: committedAgents,
    viewer,
    commitmentResults,
  });

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-10">
      <Link
        href="/rounds"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} weight="bold" />
        Back to rounds
      </Link>

      <RoundHero round={round} question={question} phase={lifecycle.phase} />

      <Panel>
        <div className="p-6 sm:p-7">
          <RoundCountdown
            lifecycle={lifecycle}
            outcomeBps={round.outcome}
          />
        </div>
      </Panel>

      <RoundPhaseTrack phase={lifecycle.phase} />

      <ActionForPhase
        lifecycle={lifecycle}
        round={round}
        ownedCount={ownedAgents.length}
        onEnter={() => setEnterOpen(true)}
      />

      <CommittedAgents agents={committedViews} phase={lifecycle.phase} />

      <RoundAnchors
        round={round}
        predictionRoundAddress={ADDRESSES.predictionRound}
        roundMetadataAddress={ADDRESSES.roundMetadata}
      />

      {viewer && (
        <EnterRoundDialog
          roundId={roundId}
          entryFee={round.entryFee}
          ownedAgents={ownedAgents}
          question={question}
          open={enterOpen}
          ownerAddress={viewer}
          onClose={() => setEnterOpen(false)}
          onSuccess={() => {
            refetch();
            refetchAgents();
          }}
        />
      )}
    </div>
  );
}

function ActionForPhase({
  lifecycle,
  round,
  ownedCount,
  onEnter,
}: {
  lifecycle: ReturnType<typeof useRoundLifecycle>;
  round: RoundData;
  ownedCount: number;
  onEnter: () => void;
}) {
  if (
    lifecycle.phase === "awaiting-commits" ||
    lifecycle.phase === "commits-closing"
  ) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: CINEMATIC_EASE }}
      >
        <YourTurnPanel
          entryFee={round.entryFee}
          urgent={lifecycle.phase === "commits-closing"}
          ownedCount={ownedCount}
          onEnter={onEnter}
        />
      </motion.div>
    );
  }
  if (
    lifecycle.phase === "awaiting-reveals" ||
    lifecycle.phase === "reveals-closing"
  ) {
    return (
      <RevealStatusPanel
        revealed={Number(round.totalRevealed)}
        total={Number(round.totalCommitted)}
        urgent={lifecycle.phase === "reveals-closing"}
      />
    );
  }
  if (lifecycle.phase === "awaiting-oracle") {
    return <OracleResearchPanel />;
  }
  if (lifecycle.phase === "resolved") {
    return <ResolvedSummaryPanel yourAgents={[]} />;
  }
  return null;
}

function buildCommittedViews({
  round,
  agentIds,
  rows,
  viewer,
  commitmentResults,
}: {
  round: RoundData;
  agentIds: bigint[];
  rows: ReturnType<typeof useAgentRows>["agents"];
  viewer: Address | undefined;
  commitmentResults:
    | Array<{
        status: "success" | "failure";
        result?: unknown;
        error?: unknown;
      }>
    | undefined;
}): CommittedAgentView[] {
  const rowsById = new Map(rows.map((r) => [r.id.toString(), r]));
  return agentIds.map((id, i) => {
    const row = rowsById.get(id.toString());
    const commitment =
      commitmentResults?.[i]?.status === "success"
        ? (commitmentResults[i]!.result as {
            commitHash: `0x${string}`;
            prediction: number;
            revealed: boolean;
            exists: boolean;
          })
        : undefined;

    const name =
      row && row.name && row.name.length > 0 ? row.name : `Agent #${id}`;
    const owner = (row?.owner ?? ("0x" + "0".repeat(40))) as `0x${string}`;
    const ownerShort =
      owner === "0x" + "0".repeat(40)
        ? "—"
        : `${owner.slice(0, 6)}…${owner.slice(-4)}`;
    const isYou =
      viewer && owner !== "0x" + "0".repeat(40)
        ? owner.toLowerCase() === viewer.toLowerCase()
        : undefined;

    let state: CommittedAgentView["state"] = "missing";
    let predictionBps: number | undefined;
    let scoreDeltaBps: number | undefined;

    if (commitment?.exists) {
      if (commitment.revealed) {
        state = "revealed";
        predictionBps = commitment.prediction;
        if (round.resolved) {
          const distance = Math.abs(predictionBps - Number(round.outcome));
          scoreDeltaBps = 10000 - 2 * distance;
        }
      } else {
        state = "sealed";
      }
    }

    return {
      id,
      name,
      generation: row?.generation ?? 0,
      owner,
      ownerShort,
      isYou,
      state,
      commitHash: commitment?.commitHash,
      predictionBps,
      scoreDeltaBps,
    };
  });
}
