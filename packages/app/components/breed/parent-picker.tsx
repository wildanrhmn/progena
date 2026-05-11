"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import makeBlockie from "ethereum-blockies-base64";
import { ArrowUpRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import { displayNameOf, type AgentRow } from "@/hooks/use-agents";
import { generationLabel, shortHash } from "@/lib/format";

type Props = {
  open: boolean;
  agents: AgentRow[];
  excludeId?: bigint;
  title: string;
  onClose: () => void;
  onPick: (agent: AgentRow) => void;
};

export function ParentPickerModal({
  open,
  agents,
  excludeId,
  title,
  onClose,
  onPick,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = agents.filter((a) => {
    if (excludeId !== undefined && a.id === excludeId) return false;
    const rootHashIsZero = /^0x0+$/.test(a.rootHash);
    if (rootHashIsZero) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.id.toString().includes(q) ||
      `gen ${a.generation}`.includes(q)
    );
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-10">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[calc(100vh-5rem)] w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-2xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-lineage/60 to-transparent"
            />

            <div className="border-b border-zinc-800/80 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="text-zinc-500 transition-colors hover:text-zinc-100"
                  aria-label="Close"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3">
                <MagnifyingGlass size={14} className="text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, id, or generation"
                  autoFocus
                  className="w-full bg-transparent py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3">
              {filtered.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No matching finalized agents.
                </div>
              ) : (
                <ul className="grid gap-1.5">
                  {filtered.map((agent) => (
                    <li key={agent.id.toString()}>
                      <button
                        onClick={() => {
                          onPick(agent);
                          onClose();
                        }}
                        className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-zinc-800 hover:bg-zinc-900/40"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={makeBlockie(agent.rootHash)}
                          alt=""
                          className="h-10 w-10 rounded-sm border border-white/15"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-sm text-foreground">
                              {displayNameOf(agent)}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                              #{agent.id.toString()}
                            </span>
                          </div>
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {generationLabel(agent.generation)} · root{" "}
                            {shortHash(agent.rootHash, 6, 4)}
                          </div>
                        </div>
                        <ArrowUpRight size={14} className="text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
