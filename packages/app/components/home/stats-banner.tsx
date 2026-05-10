"use client";

import { motion } from "framer-motion";
import { useChainStats } from "@/hooks/use-stats";
import { chain } from "@/lib/chain";

function formatBig(n: bigint | undefined): string {
  if (n === undefined) return "—";
  return n.toString();
}

export function StatsBanner() {
  const { stats, isLoading } = useChainStats();

  const items = [
    {
      label: "Agents minted",
      value: isLoading ? "…" : formatBig(stats.totalMinted),
    },
    {
      label: "Rounds created",
      value: isLoading ? "…" : formatBig(stats.roundsCreated),
    },
    {
      label: "Network",
      value: chain.name,
    },
    {
      label: "Chain ID",
      value: chain.id.toString(),
    },
  ];

  return (
    <section className="border-t border-border-soft bg-background px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border-soft md:grid-cols-4">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="flex flex-col gap-1.5 bg-background px-6 py-6"
            >
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </span>
              <span className="font-display text-3xl text-foreground">
                {item.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
