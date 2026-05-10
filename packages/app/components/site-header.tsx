"use client";

import Link from "next/link";
import { CircleHalf } from "@phosphor-icons/react";
import { ConnectButton } from "./connect-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-soft bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-medium text-foreground">
          <CircleHalf size={20} weight="duotone" className="text-accent-life" />
          <span className="tracking-tight">progena</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/agents" className="transition-colors hover:text-foreground">
            Agents
          </Link>
          <Link href="/rounds" className="transition-colors hover:text-foreground">
            Rounds
          </Link>
          <Link href="/breed" className="transition-colors hover:text-foreground">
            Breed
          </Link>
          <Link href="/leaderboard" className="transition-colors hover:text-foreground">
            Leaderboard
          </Link>
        </nav>

        <ConnectButton />
      </div>
    </header>
  );
}
