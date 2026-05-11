import type { RoundStatus } from "@/hooks/use-rounds";

const STYLES: Record<RoundStatus, { label: string; tone: string }> = {
  NonExistent: {
    label: "—",
    tone: "border-zinc-700 bg-zinc-900/60 text-zinc-400",
  },
  Open: {
    label: "Committing",
    tone: "border-accent-life/40 bg-accent-life/10 text-accent-life",
  },
  RevealPhase: {
    label: "Revealing",
    tone: "border-amber-700/50 bg-amber-900/20 text-amber-300",
  },
  Closed: {
    label: "Awaiting resolve",
    tone: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  },
  Resolved: {
    label: "Resolved",
    tone: "border-accent-lineage/40 bg-accent-lineage/10 text-accent-lineage",
  },
};

export function RoundStatusPill({ status }: { status: RoundStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${s.tone}`}
    >
      {s.label}
    </span>
  );
}
