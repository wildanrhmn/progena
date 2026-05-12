"use client";

import Link from "next/link";
import { ProgenaMark } from "@/components/logo/progena-mark";
import { ConnectButton } from "./connect-button";

const navLinks = [
  { href: "/agents", label: "Agents" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/breed", label: "Breed" },
  { href: "/rounds", label: "Rounds" },
];

export function SiteHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 p-4 sm:p-6">
      <nav className="mx-auto grid h-14 max-w-6xl grid-cols-[auto_1fr_auto] items-center rounded-full border border-zinc-800/60 bg-zinc-950/80 pl-5 pr-2 backdrop-blur-xl sm:pl-7">
        <Link
          href="/"
          className="flex items-center gap-2 text-zinc-100"
          aria-label="Progena home"
        >
          <ProgenaMark size={20} className="text-white" />
          <span className="font-display text-xl italic tracking-tight">
            progena
          </span>
        </Link>

        <div className="hidden items-center justify-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-100"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="justify-self-end">
          <ConnectButton />
        </div>
      </nav>
    </header>
  );
}
