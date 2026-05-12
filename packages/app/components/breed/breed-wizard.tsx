"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { motion } from "framer-motion";
import makeBlockie from "ethereum-blockies-base64";
import {
  decodeEventLog,
  encodePacked,
  formatEther,
  keccak256,
  type Address,
} from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { agentGenomeAbi } from "@progena/sdk";
import {
  ArrowLeft,
  ArrowRight,
  CaretRight,
  CircleNotch,
  GitFork,
  Sparkle,
  Swap,
  Wallet,
  X,
} from "@phosphor-icons/react";
import { breedingContract } from "@/lib/contracts";
import {
  useAgents,
  displayNameOf,
  type AgentRow,
} from "@/hooks/use-agents";
import { useBreedingFee } from "@/hooks/use-breed";
import { useStudFee } from "@/hooks/use-stud-fee";
import { Panel, BracketBox } from "@/components/ui/panel";
import { ParentPickerModal } from "./parent-picker";
import { BirthOverlay } from "./birth-overlay";
import { generationLabel, shortHash } from "@/lib/format";

type Props = { initialParentA?: bigint };

export function BreedWizard({ initialParentA }: Props) {
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();
  const viewer = (
    authenticated ? user?.wallet?.address : undefined
  ) as Address | undefined;

  const { agents, isLoading: agentsLoading } = useAgents(100);

  const [parentAId, setParentAId] = useState<bigint | undefined>(initialParentA);
  const [parentBId, setParentBId] = useState<bigint | undefined>();
  const [pickerOpen, setPickerOpen] = useState<"A" | "B" | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const parentA = agents.find((a) => a.id === parentAId);
  const parentB = agents.find((a) => a.id === parentBId);

  const childGeneration = useMemo(() => {
    if (!parentA || !parentB) return undefined;
    return Math.max(parentA.generation, parentB.generation) + 1;
  }, [parentA, parentB]);

  const { data: feeRaw } = useBreedingFee(viewer, parentAId, parentBId);
  const fee = (feeRaw as bigint | undefined) ?? 0n;

  const { data: feeARaw } = useStudFee(parentAId);
  const { data: feeBRaw } = useStudFee(parentBId);
  const studFeeA = (feeARaw as bigint | undefined) ?? 0n;
  const studFeeB = (feeBRaw as bigint | undefined) ?? 0n;
  const referencePrice = studFeeA + studFeeB;
  const youOwnA = !!(
    parentA &&
    viewer &&
    parentA.owner.toLowerCase() === viewer.toLowerCase()
  );
  const youOwnB = !!(
    parentB &&
    viewer &&
    parentB.owner.toLowerCase() === viewer.toLowerCase()
  );

  const {
    writeContract,
    data: breedTxHash,
    isPending: breedPending,
    reset: resetBreed,
    error: breedError,
  } = useWriteContract();
  const {
    isLoading: breedConfirming,
    data: breedReceipt,
  } = useWaitForTransactionReceipt({ hash: breedTxHash });

  useEffect(() => {
    if (breedError) setOverlayOpen(false);
  }, [breedError]);

  const [childTokenId, setChildTokenId] = useState<bigint | undefined>();
  useEffect(() => {
    if (!breedReceipt || childTokenId !== undefined) return;
    for (const log of breedReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: agentGenomeAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "Bred") {
          const args = decoded.args as unknown as { tokenId: bigint };
          setChildTokenId(args.tokenId);
          return;
        }
      } catch {
        continue;
      }
    }
  }, [breedReceipt, childTokenId]);

  const previewChildRootHash = useMemo(() => {
    if (!parentA || !parentB || childTokenId === undefined) return undefined;
    return keccak256(
      encodePacked(
        ["bytes32", "bytes32", "uint256"],
        [parentA.rootHash, parentB.rootHash, childTokenId]
      )
    );
  }, [parentA, parentB, childTokenId]);

  const submitBreed = () => {
    if (parentAId === undefined || parentBId === undefined) return;
    if (!parentA || !parentB) return;
    setChildTokenId(undefined);
    resetBreed();
    setOverlayOpen(true);
    writeContract({
      ...breedingContract,
      functionName: "breed",
      args: [parentAId, parentBId],
      value: fee,
    });
  };

  if (agentsLoading && agents.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <CircleNotch size={14} className="mr-2 animate-spin" />
        Loading agents…
      </div>
    );
  }

  if (!authenticated) {
    return <ConnectPrompt onConnect={login} />;
  }

  const bothSelected = Boolean(
    parentA && parentB && parentAId !== parentBId && parentAId !== undefined
  );

  return (
    <div className="space-y-8">
      <Link
        href="/agents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} weight="bold" />
        Back to agents
      </Link>

      <div className="space-y-3">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
        >
          Breed agents
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="text-balance text-4xl tracking-tight text-foreground sm:text-5xl"
        >
          Combine two agents into a{" "}
          <span className="font-display italic text-accent-lineage">
            new generation
          </span>
          .
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="max-w-2xl text-pretty text-base text-muted-foreground"
        >
          Pick two finalized agents. A deterministic crossover combines their
          genome into a new INFT. Every ancestor in the lineage earns
          royalties forever via the on-chain pull-payment splitter.
        </motion.p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_0.85fr_1fr]">
        <ParentSlot
          label="Parent A"
          agent={parentA}
          onPick={() => setPickerOpen("A")}
          onClear={() => setParentAId(undefined)}
        />
        <ChildPreview
          parentA={parentA}
          parentB={parentB}
          generation={childGeneration}
          ready={bothSelected}
          minted={childTokenId !== undefined}
        />
        <ParentSlot
          label="Parent B"
          agent={parentB}
          onPick={() => setPickerOpen("B")}
          onClear={() => setParentBId(undefined)}
        />
      </div>

      <CascadePanel
        parentA={parentA}
        parentB={parentB}
        studFeeA={studFeeA}
        studFeeB={studFeeB}
        youOwnA={youOwnA}
        youOwnB={youOwnB}
      />

      <Panel>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
              You pay
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-light tracking-tight text-foreground">
                {formatEther(fee)}
              </span>
              <span className="text-base text-muted-foreground">OG</span>
              {referencePrice > 0n && fee < referencePrice && (
                <span className="rounded-full border border-accent-life/40 bg-accent-life/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-life">
                  Saved {formatEther(referencePrice - fee)} OG
                </span>
              )}
            </div>
            {parentA && parentB && referencePrice > 0n && (
              <p className="mt-2 text-xs text-muted-foreground">
                Reference price for non-owners:{" "}
                <span className="font-mono text-foreground/80">
                  {formatEther(referencePrice)} OG
                </span>{" "}
                · routes through RoyaltySplitter
              </p>
            )}
            {breedError && (
              <p className="mt-3 text-xs text-red-400">
                {breedError.message.split("\n")[0]}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              onClick={submitBreed}
              disabled={
                breedPending || breedConfirming || overlayOpen || !bothSelected
              }
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(breedPending || breedConfirming) && (
                <CircleNotch size={14} className="animate-spin" />
              )}
              {breedPending
                ? "Confirm in wallet…"
                : breedConfirming
                  ? "Crossing genomes…"
                  : bothSelected
                    ? "Breed"
                    : "Pick two parents"}
              {!breedPending && !breedConfirming && bothSelected && (
                <ArrowRight size={14} weight="bold" />
              )}
            </button>
          </div>
        </div>
      </Panel>

      <ParentPickerModal
        open={pickerOpen === "A"}
        agents={agents}
        excludeId={parentBId}
        title="Pick parent A"
        onClose={() => setPickerOpen(null)}
        onPick={(a) => setParentAId(a.id)}
      />
      <ParentPickerModal
        open={pickerOpen === "B"}
        agents={agents}
        excludeId={parentAId}
        title="Pick parent B"
        onClose={() => setPickerOpen(null)}
        onPick={(a) => setParentBId(a.id)}
      />

      {parentA && parentB && (
        <BirthOverlay
          open={overlayOpen}
          parentA={parentA}
          parentB={parentB}
          childRootHash={previewChildRootHash}
          childTokenId={childTokenId}
          dismissable={false}
          onClose={() => setOverlayOpen(false)}
          onNameClaimed={() => {
            if (childTokenId !== undefined) {
              router.push(`/agents/${childTokenId.toString()}`);
            }
            setOverlayOpen(false);
          }}
        />
      )}

    </div>
  );
}

function ParentSlot({
  label,
  agent,
  onPick,
  onClear,
}: {
  label: string;
  agent: AgentRow | undefined;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!agent) {
    return (
      <button
        onClick={onPick}
        className="group flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 px-6 py-10 text-center transition-colors hover:border-muted-foreground hover:bg-muted/20"
      >
        <Swap size={28} weight="duotone" className="text-accent-lineage" />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium text-foreground">
          Pick an agent
        </div>
      </button>
    );
  }

  const tag =
    agent.generation === 0
      ? {
          label: "Genesis",
          tone: "border-accent-life/40 bg-accent-life/10 text-accent-life",
        }
      : {
          label: `Gen ${agent.generation}`,
          tone: "border-accent-lineage/40 bg-accent-lineage/10 text-accent-lineage",
        };

  return (
    <Panel>
      <div className="flex h-full flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <button
            onClick={onClear}
            className="text-zinc-500 transition-colors hover:text-zinc-100"
            aria-label="Clear"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <BracketBox className="flex h-44 w-full items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={makeBlockie(agent.rootHash)}
            alt=""
            className="h-28 w-28 rounded-sm border border-white/15"
            style={{ imageRendering: "pixelated" }}
          />
        </BracketBox>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-medium text-foreground">
              {displayNameOf(agent)}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              #{agent.id.toString()} · {generationLabel(agent.generation)}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tag.tone}`}
          >
            {tag.label}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3 font-mono text-[10px] text-muted-foreground">
          <span>root {shortHash(agent.rootHash, 6, 4)}</span>
          <button
            onClick={onPick}
            className="text-foreground/80 underline-offset-2 hover:underline"
          >
            change
          </button>
        </div>
      </div>
    </Panel>
  );
}

function ChildPreview({
  parentA,
  parentB,
  generation,
  ready,
  minted,
}: {
  parentA: AgentRow | undefined;
  parentB: AgentRow | undefined;
  generation: number | undefined;
  ready: boolean;
  minted: boolean;
}) {
  return (
    <Panel>
      <div className="flex h-full flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Child
          </div>
          {ready && (
            <span className="rounded-full border border-accent-lineage/40 bg-accent-lineage/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-lineage">
              Gen {generation}
            </span>
          )}
        </div>

        <BracketBox className="relative flex h-44 w-full items-center justify-center overflow-hidden p-4">
          {minted ? (
            <span className="text-[11px] uppercase tracking-wider text-accent-life">
              minted ✓
            </span>
          ) : ready ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative"
            >
              <motion.div
                animate={{ opacity: [0.4, 0.85, 0.4] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-sm blur-xl"
                style={{
                  background:
                    "radial-gradient(circle, oklch(0.7 0.18 290 / 0.45), transparent 70%)",
                }}
              />
              <div className="relative grid h-28 w-28 grid-cols-8 grid-rows-8 gap-px overflow-hidden rounded-sm border border-white/15 bg-zinc-950 p-px">
                {Array.from({ length: 64 }).map((_, i) => {
                  const seedA =
                    (parentA?.rootHash?.charCodeAt(i % 64) ?? 0) % 8;
                  const seedB =
                    (parentB?.rootHash?.charCodeAt(i % 64) ?? 0) % 8;
                  const lit = (seedA + seedB + i) % 3 === 0;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: lit ? 0.9 : 0.18 }}
                      transition={{
                        delay: (i % 16) * 0.02,
                        duration: 0.6,
                      }}
                      className={lit ? "bg-accent-lineage" : "bg-white/10"}
                    />
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <GitFork
                size={32}
                weight="duotone"
                className="text-accent-lineage/60"
              />
              <span className="text-[11px] uppercase tracking-wider">
                awaiting parents
              </span>
            </div>
          )}
        </BracketBox>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-medium text-foreground">
              {minted ? "Minted" : ready ? "Ready to mint" : "—"}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {ready ? `Gen ${generation}` : "Gen ?"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3 font-mono text-[10px] text-muted-foreground">
          <span>root assigned at finalization</span>
        </div>
      </div>
    </Panel>
  );
}

function CascadePanel({
  parentA,
  parentB,
  studFeeA,
  studFeeB,
  youOwnA,
  youOwnB,
}: {
  parentA: AgentRow | undefined;
  parentB: AgentRow | undefined;
  studFeeA: bigint;
  studFeeB: bigint;
  youOwnA: boolean;
  youOwnB: boolean;
}) {
  return (
    <Panel>
      <div className="p-6">
        <div className="mb-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
          <Sparkle size={12} weight="bold" />
          Royalty cascade
        </div>

        {!parentA || !parentB ? (
          <p className="text-sm text-muted-foreground">
            Once you pick both parents, this panel shows the stud fees each
            charges (waived if you own them) and the long-tail royalty path
            future descendants will pay back to this lineage.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
            <CascadeRow agent={parentA} studFee={studFeeA} youOwn={youOwnA} />
            <div className="hidden items-center justify-center md:flex">
              <CaretRight
                size={20}
                weight="bold"
                className="text-muted-foreground"
              />
            </div>
            <CascadeRow agent={parentB} studFee={studFeeB} youOwn={youOwnB} />
          </div>
        )}

        {parentA && parentB && (
          <p className="mt-5 border-t border-white/10 pt-4 text-xs text-muted-foreground">
            When someone else later breeds with the agent you mint, the fee
            cascades back to{" "}
            <span className="text-foreground/80">
              {parentA.name || `#${parentA.id}`}
            </span>{" "}
            and{" "}
            <span className="text-foreground/80">
              {parentB.name || `#${parentB.id}`}
            </span>
            's owners, then to their parents, and so on for{" "}
            <span className="text-foreground/80">4 levels</span> of ancestors.
          </p>
        )}
      </div>
    </Panel>
  );
}

function CascadeRow({
  agent,
  studFee,
  youOwn,
}: {
  agent: AgentRow;
  studFee: bigint;
  youOwn: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={makeBlockie(agent.rootHash)}
        alt=""
        className="h-10 w-10 shrink-0 rounded-sm border border-white/15"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">
          {displayNameOf(agent)}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {generationLabel(agent.generation)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-foreground tabular-nums">
          {formatEther(studFee)} OG
        </div>
        <div className="text-[10px] uppercase tracking-wider">
          {studFee === 0n ? (
            <span className="text-muted-foreground">no fee</span>
          ) : youOwn ? (
            <span className="text-accent-life">waived · you own</span>
          ) : (
            <span className="text-amber-300">stud fee</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 py-20 text-center">
      <Wallet size={32} weight="duotone" className="mb-4 text-accent-life" />
      <h2 className="mb-2 text-xl tracking-tight text-foreground">
        Connect to breed
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Sign in via Privy. Breeding mints a new INFT to your wallet — the
        contract waives stud fees for any parents you own.
      </p>
      <button
        onClick={onConnect}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-colors hover:bg-emerald-500"
      >
        <Wallet size={15} weight="bold" />
        Sign in
      </button>
    </div>
  );
}
