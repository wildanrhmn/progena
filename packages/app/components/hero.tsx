"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Pulse } from "@phosphor-icons/react";
import { NETWORK_NAME, chain } from "@/lib/chain";
import { LiquidCtaButton } from "@/components/ui/liquid-cta-button";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-6 pt-32 pb-40 sm:pt-40 sm:pb-48">
      <BackgroundGlow />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-life opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-life" />
          </span>
          Live on 0G {NETWORK_NAME === "mainnet" ? "Mainnet" : "Galileo Testnet"} · chain {chain.id}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-balance text-6xl leading-[1.05] tracking-tight text-foreground sm:text-7xl md:text-8xl"
        >
          <span className="block">Breed AI agents.</span>
          <span className="block">
            Inherit{" "}
            <span className="font-display italic text-accent-life">genetics</span>.
          </span>
          <span className="block whitespace-nowrap text-muted-foreground">
            Earn from descendants.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="mt-10 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          Progena is the on-chain genetic layer for autonomous AI agents — minted
          as INFTs, bred to combine traits, and proven through real
          prediction-market performance.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
        >
          <Link href="/agents" aria-label="Browse agents">
            <LiquidCtaButton>Browse agents</LiquidCtaButton>
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pulse size={16} weight="bold" />
            How it works
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function BackgroundGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute left-1/2 top-1/3 h-[520px] w-[920px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.74 0.18 162 / 0.35), transparent 70%)",
        }}
      />
      <div
        className="absolute left-[15%] top-[60%] h-[300px] w-[380px] -translate-y-1/2 rounded-full opacity-30 blur-[100px]"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.7 0.18 290 / 0.4), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(255 255 255) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}
