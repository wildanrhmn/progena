"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "life" | "lineage" | "neutral";

const TONE_STYLES: Record<Tone, { border: string; accent: string }> = {
  life: {
    border: "border-accent-life/30 bg-accent-life/[0.04]",
    accent: "text-accent-life/90",
  },
  lineage: {
    border: "border-accent-lineage/30 bg-accent-lineage/[0.04]",
    accent: "text-accent-lineage/90",
  },
  neutral: {
    border: "border-zinc-800/70 bg-zinc-900/30",
    accent: "text-zinc-300",
  },
};

interface CollapserProps {
  open: boolean;
  collapsedHeight: number;
  children: ReactNode;
}

function Collapser({ open, collapsedHeight, children }: CollapserProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [openHeight, setOpenHeight] = useState<number>(collapsedHeight);

  useEffect(() => {
    if (!innerRef.current) return;
    setOpenHeight(innerRef.current.scrollHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setOpenHeight(entry.target.scrollHeight);
    });
    ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <motion.div
      initial={false}
      animate={{ height: open ? openHeight : collapsedHeight }}
      style={{ overflow: "hidden" }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}

interface ExpandableTextProps {
  tone?: Tone;
  label: string;
  text: string;
  previewLines?: 2 | 3 | 4;
  footnote?: string;
}

const PREVIEW_HEIGHT_FOR_LINES: Record<2 | 3 | 4, number> = {
  2: 48,
  3: 72,
  4: 96,
};

export function ExpandableText({
  tone = "lineage",
  label,
  text,
  previewLines = 3,
  footnote,
}: ExpandableTextProps) {
  const [open, setOpen] = useState(false);
  const tones = TONE_STYLES[tone];
  const collapsed = PREVIEW_HEIGHT_FOR_LINES[previewLines];
  const isLong = text.length > 160;

  return (
    <div className={`space-y-2 rounded-md border p-3 ${tones.border}`}>
      <div className={`text-xs uppercase tracking-wider ${tones.accent}`}>
        {label}
      </div>
      <Collapser open={open || !isLong} collapsedHeight={collapsed}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
          {text}
        </p>
      </Collapser>
      {isLong && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`text-xs underline-offset-2 transition-opacity hover:opacity-80 hover:underline ${tones.accent}`}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
      {footnote && (
        <p className="text-xs text-muted-foreground">{footnote}</p>
      )}
    </div>
  );
}

interface ExpandableListItem {
  key: string;
  label: string;
  body: string;
}

interface ExpandableListProps {
  tone?: Tone;
  heading: string;
  items: ExpandableListItem[];
  initial?: number;
}

export function ExpandableList({
  tone = "life",
  heading,
  items,
  initial = 2,
}: ExpandableListProps) {
  const [open, setOpen] = useState(false);
  const tones = TONE_STYLES[tone];
  const hasMore = items.length > initial;
  const visible = open ? items : items.slice(0, initial);

  return (
    <div className={`space-y-2 rounded-md border p-3 ${tones.border}`}>
      <div className={`text-xs uppercase tracking-wider ${tones.accent}`}>
        {heading}
      </div>
      <motion.ol
        initial={false}
        className="space-y-2"
        layout
        transition={{ duration: 0.42, ease: EASE }}
      >
        {visible.map((item) => (
          <motion.li
            key={item.key}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="rounded border border-white/5 bg-zinc-950/60 p-2.5"
          >
            <div className={`text-xs uppercase tracking-wider ${tones.accent}`}>
              {item.label}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
              {item.body}
            </p>
          </motion.li>
        ))}
      </motion.ol>
      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`text-xs underline-offset-2 transition-opacity hover:opacity-80 hover:underline ${tones.accent}`}
        >
          {open
            ? "Show fewer"
            : `Show ${items.length - initial} more source${items.length - initial === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}
