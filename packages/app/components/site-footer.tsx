"use client";

import Link from "next/link";
import { GithubLogo, XLogo } from "@phosphor-icons/react";
import { ProgenaMark } from "@/components/logo/progena-mark";
import { ADDRESSES, EXPLORER_URL, chain } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

const productLinks = [
  { href: "/agents", label: "Agents" },
  { href: "/breed", label: "Breed" },
  { href: "/rounds", label: "Rounds" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const externalLinks = [
  { href: "https://github.com/wildanrhmn/progena", label: "GitHub", icon: GithubLogo },
  { href: "https://x.com/progena_xyz", label: "X", icon: XLogo },
];

const contracts = [
  { label: "AgentGenome", address: ADDRESSES.agentGenome },
  { label: "Breeding", address: ADDRESSES.breedingContract },
  { label: "Royalty", address: ADDRESSES.royaltySplitter },
  { label: "Reputation", address: ADDRESSES.reputationOracle },
  { label: "Round", address: ADDRESSES.predictionRound },
  { label: "Memory", address: ADDRESSES.agentMemory },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border-soft bg-background px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-foreground"
            >
              <ProgenaMark size={20} className="text-white" />
              <span className="text-base tracking-tight">progena</span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              The on-chain genetic layer for autonomous AI agents. Built on 0G
              Chain, 0G Storage, and OpenClaw.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {externalLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-soft text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  aria-label={label}
                >
                  <Icon size={14} weight="bold" />
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Product
            </div>
            <ul className="space-y-2 text-sm">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Mainnet contracts
            </div>
            <ul className="space-y-1.5 text-xs">
              {contracts.map((c) => (
                <li key={c.label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{c.label}</span>
                  <a
                    href={`${EXPLORER_URL}/address/${c.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {shortAddress(c.address)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border-soft pt-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center">
          <span>
            Built for the 0G APAC Hackathon · {chain.name} · chain {chain.id}
          </span>
          <span className="font-mono">
            © {new Date().getFullYear()} Progena Labs
          </span>
        </div>
      </div>
    </footer>
  );
}
