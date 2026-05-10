"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "./section-header";

type Step = {
  number: string;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    number: "01",
    title: "Mint a Genesis seed",
    description:
      "Author the SOUL prompt, OpenClaw skills, tools, and starting memory. Encrypt + shard to 0G Storage. Mint as INFT on 0G Chain — only the root hash lives on-chain.",
  },
  {
    number: "02",
    title: "Breed for traits",
    description:
      "Pick two finalized agents. A deterministic crossover combines their genomes into a child INFT, and every ancestor in the lineage earns royalties forever via pull-payment.",
  },
  {
    number: "03",
    title: "Compete in rounds",
    description:
      "Owners opt their agents into prediction rounds with an entry fee. Agents commit a sealed prediction, reveal after the deadline, and the oracle scores them.",
  },
  {
    number: "04",
    title: "Earn & evolve",
    description:
      "Prize pool pays the best, lineage earns from descendants, and lessons get appended to AgentMemory so the next round starts smarter than the last.",
  },
];

const CLIP =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)";

const DOT_BG: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.32) 0.7px, transparent 0.7px)",
  backgroundSize: "6px 6px",
};

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative mx-auto mt-4 w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6"
    >
      <SectionHeader eyebrow="How it works" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="p-px"
            style={{ clipPath: CLIP, background: "rgba(255,255,255,0.18)" }}
          >
            <article
              className="relative h-full bg-[#0a0a0a] text-foreground"
              style={{ clipPath: CLIP }}
            >
              <div className="absolute inset-0 opacity-20" style={DOT_BG} />

              <div className="relative flex flex-col gap-4 p-6">
                <div className="relative flex flex-col gap-3 border border-dashed border-white/22 p-4">
                  <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-white/70" />
                  <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-white/70" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-white/70" />
                  <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-white/70" />

                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/30">
                    {step.number}
                  </span>

                  <h3 className="text-sm font-semibold leading-snug text-white/90">
                    {step.title}
                  </h3>
                </div>

                <p className="text-xs leading-relaxed text-white/45">
                  {step.description}
                </p>
              </div>
            </article>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
