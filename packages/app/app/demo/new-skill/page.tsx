"use client";

import { useState } from "react";
import { dispatchEarnedSkillToast } from "@/components/notifications/earned-skill-toast";

const PRESETS = [
  {
    label: "Onchain probe",
    skillName: "earned-onchain-probe",
    agentName: "Alpha",
    agentTokenId: "1",
    earnedInRound: "12",
    reasoning:
      "Discovered that querying balanceOf on the bridge contract gives a 12-hour leading indicator on supply shocks. Folding this into future on-chain reads.",
  },
  {
    label: "Sentiment drift detector",
    skillName: "earned-sentiment-drift-detector",
    agentName: "Beta",
    agentTokenId: "2",
    earnedInRound: "12",
    reasoning:
      "Noticed the divergence between credible accounts and broader sentiment narrowed sharply 4 hours before the market moved. Codified the pattern.",
  },
  {
    label: "Fast-commit shortcut",
    skillName: "earned-fast-commit-shortcut",
    agentName: "Delta",
    agentTokenId: "4",
    earnedInRound: "12",
    reasoning:
      "Confirmed that on short-horizon BTC questions, the first 30 seconds of price action dominates. Skipping deeper tool calls in this regime.",
  },
];

export default function NewSkillDemoPage() {
  const [busy, setBusy] = useState(false);

  const fire = (preset: (typeof PRESETS)[number]) => {
    dispatchEarnedSkillToast({
      agentTokenId: preset.agentTokenId,
      agentName: preset.agentName,
      skillName: preset.skillName,
      reasoning: preset.reasoning,
      earnedInRound: preset.earnedInRound,
    });
  };

  const fireAll = () => {
    setBusy(true);
    PRESETS.forEach((p, i) => setTimeout(() => fire(p), i * 800));
    setTimeout(() => setBusy(false), PRESETS.length * 800);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-accent-life">
        Demo · notification
      </div>
      <h1 className="font-display text-4xl font-light text-foreground">
        New-skill toast preview
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        When one of your agents earns a new skill from a round it just played,
        a toast slides up in the bottom-right corner — even if you're already
        on a different page. The watcher diffs on-chain earned skills against
        a per-owner localStorage snapshot, so you only ever see each skill
        announced once.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => fire(p)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-left transition-colors hover:border-accent-life/40 hover:bg-zinc-900"
          >
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Fire one toast
            </div>
            <div className="mt-1 font-display text-lg font-light text-foreground">
              {p.label}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {p.agentName} · round #{p.earnedInRound}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={fireAll}
          disabled={busy}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Fire all three (staggered)
        </button>
        <a
          href="/portfolio"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-foreground transition-colors hover:border-accent-life/40 hover:bg-zinc-900"
        >
          Open Portfolio to see real ones land
        </a>
      </div>

      <div className="mt-12 rounded-lg border border-zinc-800 bg-zinc-950/50 p-5 text-xs leading-relaxed text-muted-foreground">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-foreground/80">
          How it works in production
        </div>
        On every page load (and every 8 seconds while you're on a page), the
        EarnedSkillWatcher reads <code>earnedSkillsOf</code> on AgentMetadata
        for every agent you own. It diffs the returned skill names against
        the snapshot in <code>localStorage</code>. Any new entries fire a
        toast. The snapshot is keyed by your wallet address — switch wallets
        and you start with a fresh baseline (so you don't get spammed by a
        new wallet's existing skills).
      </div>
    </div>
  );
}
