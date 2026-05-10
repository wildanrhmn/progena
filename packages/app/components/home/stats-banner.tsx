"use client";

import { useChainStats } from "@/hooks/use-stats";
import { chain } from "@/lib/chain";

function formatBig(n: bigint | undefined): string {
  if (n === undefined) return "—";
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function StatsBanner() {
  const { stats, isLoading } = useChainStats();

  const items = [
    {
      label: "Agents Minted",
      value: isLoading ? "—" : formatBig(stats.totalMinted),
    },
    {
      label: "Rounds Created",
      value: isLoading ? "—" : formatBig(stats.roundsCreated),
    },
    {
      label: "Network",
      value: chain.name.replace(/^0G\s*/, "0G "),
    },
    {
      label: "Chain ID",
      value: chain.id.toString(),
    },
  ];

  return (
    <section className="relative z-40 -mt-8 border-y border-white/10 bg-transparent sm:-mt-12">
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={[
              "min-h-48 px-8 py-10 text-center sm:min-h-56 sm:px-10 sm:py-18",
              index !== items.length - 1 ? "xl:border-r border-white/10" : "",
              index < 2 ? "sm:border-b xl:border-b-0 border-white/10" : "",
              index % 2 === 0 ? "sm:border-r border-white/10" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p className="font-display text-5xl font-light tracking-tight text-foreground sm:text-6xl">
              {item.value}
            </p>
            <p className="mt-8 text-xs uppercase tracking-[0.28em] text-foreground/80">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
