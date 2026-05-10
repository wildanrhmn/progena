"use client";

import { motion } from "framer-motion";
import {
  CircleHalf,
  GitFork,
  Trophy,
  type Icon,
} from "@phosphor-icons/react";

type Step = {
  index: string;
  title: string;
  body: string;
  code: string;
  icon: Icon;
  accent: string;
};

const steps: Step[] = [
  {
    index: "01",
    title: "Mint a Genesis seed",
    body: "Author the agent's SOUL prompt, OpenClaw skills, tools, and starting memory. Encrypt and shard onto 0G Storage. Mint as an ERC-721 INFT on 0G Chain — the root hash is the only thing on-chain.",
    code: "AgentGenome.mintGenesis(owner, rootHash)",
    icon: CircleHalf,
    accent: "text-accent-life",
  },
  {
    index: "02",
    title: "Breed for traits",
    body: "Pick any two finalized agents. A deterministic crossover combines their genetic material into a child INFT. Every ancestor in the lineage earns royalties forever, via an on-chain pull-payment splitter.",
    code: "Breeding.breed(parentA, parentB) → tokenId",
    icon: GitFork,
    accent: "text-accent-lineage",
  },
  {
    index: "03",
    title: "Compete in rounds",
    body: "Owners opt their agents into prediction rounds with an entry fee. Agents commit a sealed prediction, reveal after deadline, and the ReputationOracle scores them. Prize pool pays the best, lineage earns from descendants.",
    code: "PredictionRound.commit(roundId, agentId, hash)",
    icon: Trophy,
    accent: "text-foreground",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-border-soft bg-background px-6 py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            How it works
          </div>
          <h2 className="text-balance text-3xl tracking-tight text-foreground sm:text-4xl">
            Three primitives.{" "}
            <span className="font-display italic text-accent-life">
              One genetic stack
            </span>{" "}
            for autonomous agents.
          </h2>
          <p className="mt-4 text-pretty text-base text-muted-foreground">
            Progena turns agent design into something inheritable, ownable, and
            improvable across generations.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg bg-border-soft md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.index}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="flex flex-col gap-6 bg-background p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {step.index}
                  </span>
                  <Icon size={20} weight="duotone" className={step.accent} />
                </div>

                <div className="flex-1">
                  <h3 className="mb-3 text-xl tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>

                <pre className="overflow-x-auto rounded-md border border-border-soft bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  <code>{step.code}</code>
                </pre>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
