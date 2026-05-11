"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  X,
} from "@phosphor-icons/react";
import { BirthAnimation, type Phase } from "./birth-animation";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";
import { agentRegistryContract } from "@/lib/contracts";

const NAME_RE = /^[A-Za-z0-9 _-]{2,32}$/;

type Props = {
  open: boolean;
  parentA: AgentRow;
  parentB: AgentRow;
  /** Child rootHash to feed the reveal phase. */
  childRootHash?: `0x${string}`;
  /** Newly-minted child tokenId; enables the in-overlay name claim form. */
  childTokenId?: bigint;
  replayKey?: number;
  dismissable?: boolean;
  /** Called once name claim succeeds (and after a tiny delay so the user
   *  sees the success state). Wire this to navigate to the agent page. */
  onNameClaimed?: () => void;
  /** Called when the user explicitly closes the overlay. */
  onClose?: () => void;
};

type LogStep = {
  label: string;
  during: Phase[];
};

const buildSteps = (parentA: AgentRow, parentB: AgentRow): LogStep[] => [
  {
    label: `Reading ${displayNameOf(parentA)}'s genome from 0G Storage`,
    during: ["converging"],
  },
  {
    label: `Reading ${displayNameOf(parentB)}'s genome from 0G Storage`,
    during: ["converging"],
  },
  { label: "Decrypting parent shards", during: ["mixing"] },
  { label: "Crossing genes via 0G Compute", during: ["mixing"] },
  { label: "Sharding child genome to 0G Storage", during: ["revealing"] },
  {
    label: "Anchoring rootHash on AgentGenome",
    during: ["revealing", "settling"],
  },
];

const STATUS_FOR_PHASE: Record<Phase, string> = {
  converging: "Pairing parents…",
  mixing: "Waiting for the chain to seal the genome…",
  revealing: "Hatching",
  settling: "Born",
  done: "Born. Claim a name to make it permanent.",
};

export function BirthOverlay({
  open,
  parentA,
  parentB,
  childRootHash,
  childTokenId,
  replayKey,
  dismissable = false,
  onNameClaimed,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("converging");
  const [name, setName] = useState("");
  const [nameValidation, setNameValidation] = useState<string | null>(null);

  const {
    writeContract: writeName,
    data: nameTxHash,
    isPending: namePending,
    reset: resetName,
  } = useWriteContract();
  const { isLoading: nameConfirming, isSuccess: nameSuccess } =
    useWaitForTransactionReceipt({ hash: nameTxHash });

  useEffect(() => {
    if (!open) {
      setPhase("converging");
      setName("");
      setNameValidation(null);
      resetName();
    }
  }, [open, replayKey, resetName]);

  useEffect(() => {
    if (nameSuccess) {
      const t = setTimeout(() => onNameClaimed?.(), 700);
      return () => clearTimeout(t);
    }
  }, [nameSuccess, onNameClaimed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const canClose =
        (dismissable || phase === "done") && !(namePending || nameConfirming);
      if (canClose) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismissable, phase, namePending, nameConfirming, onClose]);

  if (typeof document === "undefined") return null;

  const steps = buildSteps(parentA, parentB);
  const canClaim = phase === "done" && childTokenId !== undefined && !nameSuccess;
  const claiming = namePending || nameConfirming;
  const effectivelyDismissable = (dismissable || phase === "done") && !claiming;

  const submitName = () => {
    if (childTokenId === undefined) return;
    if (!NAME_RE.test(name)) {
      setNameValidation(
        "2–32 chars · letters, numbers, spaces, dashes, underscores"
      );
      return;
    }
    setNameValidation(null);
    writeName({
      ...agentRegistryContract,
      functionName: "setName",
      args: [childTokenId, name],
    });
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="birth-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[110] flex items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => effectivelyDismissable && onClose?.()}
            aria-hidden
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(255 255 255) 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 95%)",
            }}
          />

          <CornerBracket position="tl" />
          <CornerBracket position="tr" />
          <CornerBracket position="bl" />
          <CornerBracket position="br" />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            className="relative mx-auto flex w-full max-w-6xl items-stretch gap-8 px-8"
          >
            <div className="hidden w-72 shrink-0 flex-col justify-center lg:flex">
              <OperationsLog steps={steps} phase={phase} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.45 }}
                className="mb-4 flex items-center gap-3 rounded-full border border-zinc-800/60 bg-zinc-950/60 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-md"
              >
                <span className="text-zinc-100">{displayNameOf(parentA)}</span>
                <span className="text-zinc-600">×</span>
                <span className="text-zinc-100">{displayNameOf(parentB)}</span>
              </motion.div>

              <div className="w-full">
                <BirthAnimation
                  parentARootHash={parentA.rootHash}
                  parentBRootHash={parentB.rootHash}
                  childRootHash={childRootHash}
                  replayKey={replayKey}
                  onPhaseChange={setPhase}
                />
              </div>

              {/* Status + name claim block */}
              <div className="mt-6 flex min-h-[3.5rem] w-full max-w-md flex-col items-center gap-3">
                <AnimatePresence mode="wait">
                  {!canClaim && !nameSuccess && (
                    <motion.div
                      key={`status-${phase}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center gap-2 text-xs"
                    >
                      {phase === "settling" ? (
                        <CheckCircle
                          size={14}
                          weight="bold"
                          className="text-accent-life"
                        />
                      ) : (
                        <CircleNotch
                          size={14}
                          className="animate-spin text-muted-foreground"
                        />
                      )}
                      <span
                        className={
                          phase === "settling"
                            ? "text-accent-life"
                            : "text-muted-foreground"
                        }
                      >
                        {STATUS_FOR_PHASE[phase]}
                      </span>
                    </motion.div>
                  )}

                  {canClaim && (
                    <motion.div
                      key="claim"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.4 }}
                      className="w-full"
                    >
                      <div className="mb-3 text-center text-xs text-accent-life">
                        Born · Agent #{childTokenId!.toString()}
                      </div>
                      <input
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setNameValidation(null);
                        }}
                        disabled={claiming}
                        placeholder="Name your new agent — e.g. Echo"
                        maxLength={32}
                        autoFocus
                        className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-center text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/60 focus:outline-none"
                      />
                      {nameValidation && (
                        <p className="mt-2 text-center text-xs text-red-400">
                          {nameValidation}
                        </p>
                      )}
                      <div className="mt-4 flex flex-col items-stretch gap-2">
                        <button
                          onClick={submitName}
                          disabled={claiming || name.length < 2}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {claiming && (
                            <CircleNotch size={14} className="animate-spin" />
                          )}
                          {namePending
                            ? "Confirm in wallet…"
                            : nameConfirming
                              ? "Claiming…"
                              : "Claim name"}
                          {!claiming && (
                            <ArrowRight size={14} weight="bold" />
                          )}
                        </button>
                        <button
                          onClick={() => onNameClaimed?.()}
                          disabled={claiming}
                          className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          Skip
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {nameSuccess && (
                    <motion.div
                      key="claimed"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center gap-2 text-sm text-accent-life"
                    >
                      <CheckCircle size={16} weight="bold" />
                      Welcome, {name}. Opening profile…
                      <ArrowRight size={14} weight="bold" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="hidden w-72 shrink-0 flex-col justify-center lg:flex">
              <TokenMeta
                parentA={parentA}
                parentB={parentB}
                phase={phase}
                childRootHash={childRootHash}
                childTokenId={childTokenId}
              />
            </div>
          </motion.div>

          {effectivelyDismissable && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => onClose?.()}
              className="absolute right-6 top-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800/80 bg-zinc-950/60 text-zinc-300 backdrop-blur-md transition-colors hover:border-zinc-700 hover:text-white"
              aria-label="Close"
            >
              <X size={14} weight="bold" />
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function OperationsLog({
  steps,
  phase,
}: {
  steps: LogStep[];
  phase: Phase;
}) {
  const order: Phase[] = ["converging", "mixing", "revealing", "settling", "done"];
  const phaseIdx = order.indexOf(phase);
  const stepState = (s: LogStep): "pending" | "active" | "done" => {
    const lastIdx = order.indexOf(s.during[s.during.length - 1]!);
    const firstIdx = order.indexOf(s.during[0]!);
    if (phaseIdx < firstIdx) return "pending";
    if (phaseIdx > lastIdx) return "done";
    return "active";
  };

  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-950/50 p-5 backdrop-blur-md">
      <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        <span className="h-1.5 w-1.5 rotate-45 border border-zinc-500" />
        Pipeline
      </div>
      <ul className="space-y-2.5">
        {steps.map((s, i) => {
          const state = stepState(s);
          return (
            <motion.li
              key={i}
              initial={false}
              animate={{ opacity: state === "pending" ? 0.35 : 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-2.5 text-xs"
            >
              <span className="mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <CheckCircle
                    size={12}
                    weight="fill"
                    className="text-accent-life"
                  />
                ) : state === "active" ? (
                  <motion.span
                    animate={{
                      opacity: [0.4, 1, 0.4],
                      scale: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="block h-1.5 w-1.5 rounded-full bg-accent-life"
                  />
                ) : (
                  <span className="block h-1.5 w-1.5 rounded-full bg-zinc-700" />
                )}
              </span>
              <span
                className={
                  state === "active"
                    ? "text-zinc-200"
                    : state === "done"
                      ? "text-zinc-400"
                      : "text-zinc-600"
                }
              >
                {s.label}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function TokenMeta({
  parentA,
  parentB,
  phase,
  childRootHash,
  childTokenId,
}: {
  parentA: AgentRow;
  parentB: AgentRow;
  phase: Phase;
  childRootHash?: `0x${string}`;
  childTokenId?: bigint;
}) {
  const childGen = Math.max(parentA.generation, parentB.generation) + 1;
  return (
    <div className="space-y-4 rounded-md border border-zinc-800/60 bg-zinc-950/50 p-5 backdrop-blur-md">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        <span className="h-1.5 w-1.5 rotate-45 border border-zinc-500" />
        Child token
      </div>
      <Row
        label="Token id"
        value={childTokenId !== undefined ? `#${childTokenId}` : "minting…"}
        mono
        muted={childTokenId === undefined}
      />
      <Row label="Generation" value={`Gen ${childGen}`} />
      <Row
        label="Parent A"
        value={`${displayNameOf(parentA)} · #${parentA.id}`}
        tone="emerald"
      />
      <Row
        label="Parent B"
        value={`${displayNameOf(parentB)} · #${parentB.id}`}
        tone="violet"
      />
      <Row
        label="Root hash"
        value={
          childRootHash
            ? `${childRootHash.slice(0, 10)}…${childRootHash.slice(-6)}`
            : phase === "converging" || phase === "mixing"
              ? "computing…"
              : "—"
        }
        mono
        muted={!childRootHash}
      />
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  muted,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  tone?: "emerald" | "violet";
}) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={`truncate text-sm ${mono ? "font-mono text-xs" : ""} ${
          muted
            ? "text-zinc-500"
            : tone === "emerald"
              ? "text-accent-life"
              : tone === "violet"
                ? "text-accent-lineage"
                : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const pos =
    position === "tl"
      ? "left-6 top-6 border-l-2 border-t-2"
      : position === "tr"
        ? "right-6 top-6 border-r-2 border-t-2"
        : position === "bl"
          ? "bottom-6 left-6 border-b-2 border-l-2"
          : "bottom-6 right-6 border-b-2 border-r-2";
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 0.7, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      aria-hidden
      className={`pointer-events-none absolute h-8 w-8 border-white/40 ${pos}`}
    />
  );
}
