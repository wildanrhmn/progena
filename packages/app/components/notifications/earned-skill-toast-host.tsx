"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkle, X } from "@phosphor-icons/react";
import Link from "next/link";
import { prettifySkillName } from "@/lib/format-skill";
import {
  EARNED_SKILL_EVENT,
  type EarnedSkillToastPayload,
} from "./earned-skill-toast";

const AUTO_DISMISS_MS = 9000;
const MAX_VISIBLE = 3;

export function EarnedSkillToastHost() {
  const [stack, setStack] = useState<EarnedSkillToastPayload[]>([]);

  useEffect(() => {
    function onEvent(e: Event) {
      const ce = e as CustomEvent<EarnedSkillToastPayload>;
      if (!ce.detail) return;
      const payload = ce.detail;
      setStack((prev) => {
        if (prev.some((t) => t.id === payload.id)) return prev;
        const next = [payload, ...prev];
        return next.slice(0, MAX_VISIBLE);
      });
      setTimeout(() => {
        setStack((prev) => prev.filter((t) => t.id !== payload.id));
      }, AUTO_DISMISS_MS);
    }
    window.addEventListener(EARNED_SKILL_EVENT, onEvent);
    return () => window.removeEventListener(EARNED_SKILL_EVENT, onEvent);
  }, []);

  const dismiss = (id: string) =>
    setStack((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[360px] max-w-[calc(100vw-3rem)] flex-col gap-3">
      <AnimatePresence initial={false}>
        {stack.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.94 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto"
          >
            <ToastCard payload={t} onDismiss={() => dismiss(t.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  payload,
  onDismiss,
}: {
  payload: EarnedSkillToastPayload;
  onDismiss: () => void;
}) {
  const pretty = prettifySkillName(payload.skillName);
  const reasoning =
    payload.reasoning.length > 140
      ? `${payload.reasoning.slice(0, 140).trim()}…`
      : payload.reasoning;
  return (
    <div className="relative overflow-hidden rounded-xl border border-accent-life/30 bg-zinc-950/95 shadow-[0_8px_40px_-10px_rgba(52,211,153,0.35)] backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full opacity-60 blur-[60px]"
        style={{ background: "oklch(0.74 0.18 162 / 0.45)" }}
      />
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent-life">
            <Sparkle size={12} weight="fill" />
            New skill earned
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-zinc-900 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-xl font-light text-foreground">
            {payload.agentName}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            just learned
          </span>
        </div>
        <div className="mt-1 font-display text-2xl font-light text-accent-life">
          {pretty}
        </div>
        {reasoning && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {reasoning}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wider">
          <span className="text-muted-foreground">
            earned in round #{payload.earnedInRound}
          </span>
          <Link
            href={`/agents/${payload.agentTokenId}`}
            className="text-accent-life transition-colors hover:text-accent-life/80"
            onClick={onDismiss}
          >
            View agent →
          </Link>
        </div>
      </div>
    </div>
  );
}
