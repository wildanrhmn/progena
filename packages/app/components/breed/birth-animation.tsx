"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import makeBlockie from "ethereum-blockies-base64";

export type Phase = "converging" | "mixing" | "revealing" | "settling" | "done";

type Props = {
  parentARootHash: `0x${string}`;
  parentBRootHash: `0x${string}`;
  /**
   * Final child rootHash. If undefined the animation loops the mixing phase
   * until it's set — letting us tie this to a real on-chain receipt.
   */
  childRootHash?: `0x${string}`;
  /** Fires when phase reaches "done". */
  onComplete?: () => void;
  /** Fires on every phase transition. Useful for syncing surrounding chrome. */
  onPhaseChange?: (phase: Phase) => void;
  /** Re-run the sequence from the start. Increment to replay. */
  replayKey?: number;
};

const HEX_CHARS = "0123456789abcdef";

export function BirthAnimation({
  parentARootHash,
  parentBRootHash,
  childRootHash,
  onComplete,
  onPhaseChange,
  replayKey = 0,
}: Props) {
  const [phase, setPhase] = useState<Phase>("converging");

  const onCompleteRef = useRef(onComplete);
  const onPhaseChangeRef = useRef(onPhaseChange);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  useEffect(() => {
    onPhaseChangeRef.current?.(phase);
  }, [phase]);

  useEffect(() => {
    setPhase("converging");
    const t = setTimeout(() => setPhase("mixing"), 900);
    return () => clearTimeout(t);
  }, [replayKey]);

  useEffect(() => {
    if (phase !== "mixing") return;
    if (!childRootHash) return;
    const t = setTimeout(() => setPhase("revealing"), 700);
    return () => clearTimeout(t);
  }, [phase, childRootHash]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const t = setTimeout(() => setPhase("settling"), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "settling") return;
    const t = setTimeout(() => {
      setPhase("done");
      onCompleteRef.current?.();
    }, 1400);
    return () => clearTimeout(t);
  }, [phase]);

  const showParents = phase === "converging" || phase === "mixing";
  const showEgg = phase === "converging" || phase === "mixing";
  const showChild = phase === "revealing" || phase === "settling" || phase === "done";

  return (
    <div className="relative flex h-[34rem] items-center justify-center">
      <BackdropGlow phase={phase} />
      <ParticleField active={phase !== "done"} />

      <AnimatePresence>
        {showParents && (
          <motion.div
            key="pa"
            initial={{ x: -320, opacity: 0, scale: 0.6 }}
            animate={
              phase === "converging"
                ? { x: -180, opacity: 1, scale: 1 }
                : { x: -60, opacity: 0.35, scale: 0.85, filter: "blur(2px)" }
            }
            exit={{ x: 40, opacity: 0, scale: 0.3, filter: "blur(10px)" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-10"
          >
            <ParentSigil hash={parentARootHash} tint="emerald" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showParents && (
          <motion.div
            key="pb"
            initial={{ x: 320, opacity: 0, scale: 0.6 }}
            animate={
              phase === "converging"
                ? { x: 180, opacity: 1, scale: 1 }
                : { x: 60, opacity: 0.35, scale: 0.85, filter: "blur(2px)" }
            }
            exit={{ x: -40, opacity: 0, scale: 0.3, filter: "blur(10px)" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-10"
          >
            <ParentSigil hash={parentBRootHash} tint="violet" />
          </motion.div>
        )}
      </AnimatePresence>

      <ConnectionBeams active={phase === "mixing"} />

      <div className="relative z-20 flex h-72 w-72 items-center justify-center">
        <AnimatePresence>
          {showEgg && (
            <motion.div
              key="egg"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <Egg active={phase === "mixing"} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "revealing" && <LightBurst />}
        </AnimatePresence>

        <AnimatePresence>
          {showChild && childRootHash && (
            <motion.div
              key="child"
              initial={{ opacity: 0, scale: 0.4, filter: "blur(18px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="relative">
                <motion.div
                  animate={
                    phase === "settling"
                      ? { opacity: [0.6, 0.3, 0.6] }
                      : { opacity: 0.5 }
                  }
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden
                  className="absolute inset-0 rounded-sm blur-2xl"
                  style={{
                    background:
                      "radial-gradient(circle, oklch(0.74 0.18 162 / 0.55), oklch(0.7 0.18 290 / 0.4) 50%, transparent 80%)",
                  }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={makeBlockie(childRootHash)}
                  alt=""
                  className="relative h-44 w-44 rounded-sm border border-white/25"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <HexStream
        seed={(childRootHash ?? parentARootHash) as `0x${string}`}
        active={phase === "mixing"}
        revealing={phase === "revealing"}
      />

      <PhaseCaption phase={phase} />
    </div>
  );
}

function ParentSigil({
  hash,
  tint,
}: {
  hash: `0x${string}`;
  tint: "emerald" | "violet";
}) {
  const offset = tint === "emerald" ? "-2px 0" : "2px 0";
  const tintColor =
    tint === "emerald" ? "oklch(0.74 0.18 162 / 0.5)" : "oklch(0.7 0.18 290 / 0.5)";
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 rounded-sm blur-lg"
        style={{ background: tintColor, transform: "scale(1.15)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={makeBlockie(hash)}
        alt=""
        className="relative h-40 w-40 rounded-sm border border-white/15"
        style={{
          imageRendering: "pixelated",
          filter: `drop-shadow(${offset} ${tintColor})`,
        }}
      />
    </div>
  );
}

function BackdropGlow({ phase }: { phase: Phase }) {
  const intensity =
    phase === "converging"
      ? 0.4
      : phase === "mixing"
        ? 0.7
        : phase === "revealing"
          ? 1
          : 0.5;
  return (
    <motion.div
      animate={{ opacity: intensity }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    >
      <div
        className="absolute left-1/4 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.74 0.18 162 / 0.55), transparent 70%)",
        }}
      />
      <div
        className="absolute right-1/4 top-1/2 h-[28rem] w-[28rem] -translate-y-1/2 translate-x-1/2 rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.7 0.18 290 / 0.55), transparent 70%)",
        }}
      />
    </motion.div>
  );
}

function Egg({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className="absolute inset-0 h-full w-full"
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <linearGradient id="eggGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.74 0.18 162)" />
          <stop offset="100%" stopColor="oklch(0.7 0.18 290)" />
        </linearGradient>
      </defs>
      <motion.polygon
        points="100,15 173,57 173,143 100,185 27,143 27,57"
        fill="oklch(0.07 0 0 / 0.85)"
        stroke="url(#eggGradient)"
        strokeWidth="2"
        animate={
          active
            ? {
                rotate: [0, 4, -3, 0],
                scale: [1, 1.025, 0.985, 1],
              }
            : { rotate: 0, scale: 1 }
        }
        transition={{
          duration: 1.4,
          repeat: active ? Infinity : 0,
          ease: "easeInOut",
        }}
        style={{ transformOrigin: "100px 100px", transformBox: "fill-box" }}
      />
      {/* inner pulse */}
      <motion.polygon
        points="100,40 152,72 152,128 100,160 48,128 48,72"
        fill="none"
        stroke="oklch(0.74 0.18 162)"
        strokeWidth="1"
        strokeDasharray="4 4"
        animate={
          active
            ? {
                rotate: [0, 360],
                opacity: [0.4, 0.9, 0.4],
              }
            : { rotate: 0, opacity: 0.4 }
        }
        transition={{
          duration: 3.2,
          repeat: active ? Infinity : 0,
          ease: "linear",
        }}
        style={{ transformOrigin: "100px 100px", transformBox: "fill-box" }}
      />
      {/* scan line */}
      {active && (
        <motion.line
          x1="35"
          x2="165"
          y1="100"
          y2="100"
          stroke="oklch(0.74 0.18 162 / 0.85)"
          strokeWidth="0.6"
          animate={{ y1: [40, 160, 40], y2: [40, 160, 40] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}
    </svg>
  );
}

function LightBurst() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0, rotate: i * 36 }}
          animate={{
            opacity: [0, 0.85, 0],
            scale: [0.3, 2.4, 3],
            rotate: i * 36,
          }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          aria-hidden
          className="absolute left-1/2 top-1/2 h-1 w-32 origin-left -translate-y-1/2 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.74 0.18 162 / 0.9), oklch(0.7 0.18 290 / 0.6), transparent)",
            transform: `translate(-50%, -50%) rotate(${i * 36}deg)`,
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.2, 2, 2.4] }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(1 0 0 / 0.7), oklch(0.74 0.18 162 / 0.4) 30%, transparent 60%)",
        }}
      />
    </>
  );
}

function HexStream({
  seed,
  active,
  revealing,
}: {
  seed: `0x${string}`;
  active: boolean;
  revealing: boolean;
}) {
  const lines = useMemo(() => {
    return Array.from({ length: 4 }, (_, lineIdx) =>
      Array.from({ length: 32 }, (_, charIdx) => {
        const seedChar = seed.charCodeAt(2 + ((lineIdx * 32 + charIdx) % 62));
        return HEX_CHARS[seedChar % 16];
      }).join("")
    );
  }, [seed]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active && !revealing) return;
    const id = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(id);
  }, [active, revealing]);

  return (
    <AnimatePresence>
      {(active || revealing) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: revealing ? 0.35 : 0.7, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4 }}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-0.5 px-6 font-mono text-[10px] text-accent-life/70"
        >
          {lines.map((line, i) => {
            const shift = (tick + i) % line.length;
            const display =
              line.slice(shift, shift + 24) + line.slice(0, Math.max(0, 24 - (line.length - shift)));
            return (
              <div
                key={i}
                className="truncate"
                style={{ opacity: 0.4 + (i / lines.length) * 0.6 }}
              >
                0x{display}
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ParticleField({ active }: { active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const seed = (i * 9301 + 49297) % 233280;
        const rng = seed / 233280;
        const angle = (i / 40) * Math.PI * 2 + rng * 0.6;
        const radius = 110 + ((i * 73) % 180);
        return {
          left: 50 + Math.cos(angle) * (radius / 6),
          top: 50 + Math.sin(angle) * (radius / 8),
          size: 1 + (i % 3),
          delay: rng * 3,
          duration: 4 + ((i * 53) % 40) / 10,
          tint: i % 2 === 0 ? "emerald" : "violet",
        };
      }),
    []
  );
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          {particles.map((p, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -16, 0],
                opacity: [0.2, 0.9, 0.2],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                background:
                  p.tint === "emerald"
                    ? "oklch(0.74 0.18 162)"
                    : "oklch(0.7 0.18 290)",
                boxShadow:
                  p.tint === "emerald"
                    ? "0 0 6px oklch(0.74 0.18 162 / 0.8)"
                    : "0 0 6px oklch(0.7 0.18 290 / 0.8)",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConnectionBeams({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.svg
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="beamEmerald" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="oklch(0.74 0.18 162 / 0)" />
              <stop offset="40%" stopColor="oklch(0.74 0.18 162 / 0.6)" />
              <stop offset="100%" stopColor="oklch(0.74 0.18 162 / 0)" />
            </linearGradient>
            <linearGradient id="beamViolet" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="oklch(0.7 0.18 290 / 0)" />
              <stop offset="60%" stopColor="oklch(0.7 0.18 290 / 0.6)" />
              <stop offset="100%" stopColor="oklch(0.7 0.18 290 / 0)" />
            </linearGradient>
          </defs>
          <motion.line
            x1="30%" y1="50%" x2="50%" y2="50%"
            stroke="url(#beamEmerald)"
            strokeWidth="1.2"
            strokeDasharray="6 6"
            animate={{ strokeDashoffset: [0, -24] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
          <motion.line
            x1="70%" y1="50%" x2="50%" y2="50%"
            stroke="url(#beamViolet)"
            strokeWidth="1.2"
            strokeDasharray="6 6"
            animate={{ strokeDashoffset: [0, -24] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

function PhaseCaption({ phase }: { phase: Phase }) {
  const label =
    phase === "converging"
      ? "Pairing parents"
      : phase === "mixing"
        ? "Crossing genomes…"
        : phase === "revealing"
          ? "Hatching"
          : phase === "settling"
            ? "Born"
            : "";
  return (
    <AnimatePresence mode="wait">
      {label && (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300 backdrop-blur-md"
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
