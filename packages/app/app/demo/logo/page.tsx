"use client";

import { useState } from "react";
import { ProgenaMark } from "@/components/logo/progena-mark";

export default function LogoDemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-accent-life">
        Demo · branding · shipped
      </div>
      <h1 className="font-display text-4xl font-light text-foreground">
        Progena identity
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Crystal pair in white, integrated across the app. The three production
        assets are below — favicon (auto-wired via{" "}
        <code>metadata.icons</code>), header/footer mark (already live in{" "}
        <code>site-header.tsx</code> + <code>site-footer.tsx</code>), and
        the 1024×1024 submission asset for HackQuest.
      </p>

      <Section title="Favicon" sub="Already wired via app/layout.tsx metadata.icons. SVG with prefers-color-scheme so it auto-inverts on light browser themes.">
        <div className="grid gap-4 sm:grid-cols-4">
          {[16, 24, 32, 64].map((s) => (
            <FaviconTile key={s} size={s} />
          ))}
        </div>
        <a
          href="/favicon.svg"
          download="favicon.svg"
          className="mt-4 inline-flex rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-foreground transition-colors hover:border-accent-life/40 hover:bg-zinc-900"
        >
          Download favicon.svg
        </a>
      </Section>

      <Section title="Header + footer mark" sub="Already live across the app. Open any page and look at the navbar pill or footer.">
        <div className="flex h-16 items-center rounded-full border border-zinc-800/60 bg-zinc-950/80 pl-5 pr-2">
          <div className="flex items-center gap-2 text-zinc-100">
            <ProgenaMark size={22} className="text-white" />
            <span className="font-display text-xl italic tracking-tight">
              progena
            </span>
          </div>
          <div className="ml-8 flex gap-1 text-sm text-zinc-500">
            <span className="px-3">Agents</span>
            <span className="px-3">Portfolio</span>
            <span className="px-3">Breed</span>
            <span className="px-3">Rounds</span>
          </div>
          <div className="ml-auto rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950">
            Connect
          </div>
        </div>
      </Section>

      <Section title="Project submission logo · 1024×1024" sub="Dark background with green + lineage glows and a faint 24px grid texture. Mark only (no wordmark) — HackQuest renders the project name under it.">
        <ProjectLogoExport />
      </Section>
    </div>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-14 border-t border-zinc-800 pt-10">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Section
      </div>
      <div className="mt-1 font-display text-2xl font-light text-foreground">
        {title}
      </div>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">{sub}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function FaviconTile({ size }: { size: number }) {
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {size}px · on dark
      </div>
      <div className="flex h-24 items-center justify-center rounded-md bg-zinc-900">
        <ProgenaMark size={size} className="text-white" />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {size}px · on light
      </div>
      <div className="flex h-24 items-center justify-center rounded-md bg-zinc-100">
        <ProgenaMark size={size} className="text-neutral-950" />
      </div>
    </div>
  );
}

function ProjectLogoExport() {
  const [busy, setBusy] = useState(false);

  const downloadPng = async () => {
    setBusy(true);
    try {
      const res = await fetch("/project-logo.svg");
      const svgText = await res.text();
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg load failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d unavailable");
      ctx.drawImage(img, 0, 0, 1024, 1024);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "progena-project-logo-1024.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      window.alert(
        "PNG export failed — try the SVG download instead, or open project-logo.svg in any browser and screenshot."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid items-start gap-6 sm:grid-cols-[auto_1fr]">
        <ProjectLogoSvg size={320} />
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The SVG lives at <code>/public/project-logo.svg</code>. For the
            HackQuest upload you'll need a PNG — the button below renders the
            SVG to a canvas at 1024×1024 and downloads it.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadPng}
              disabled={busy}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Rendering…" : "Download 1024×1024 PNG"}
            </button>
            <a
              href="/project-logo.svg"
              download="progena-project-logo.svg"
              className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-foreground transition-colors hover:border-accent-life/40 hover:bg-zinc-900"
            >
              Download SVG source
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Composition: zinc-950 base + green glow top-left + lineage purple
            glow bottom-right + 48px white grid at 4% opacity + Crystal Pair
            mark in pure white at the center.
          </p>
        </div>
      </div>
    </>
  );
}

function ProjectLogoSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" className="rounded-2xl">
      <defs>
        <radialGradient id="logoGreen" cx="0.22" cy="0.22" r="0.45">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="logoPurple" cx="0.78" cy="0.78" r="0.45">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
        <pattern
          id="logoGrid"
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 48 0 L 0 0 L 0 48"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.6"
            strokeOpacity="0.04"
          />
        </pattern>
      </defs>
      <rect width="1024" height="1024" fill="#0a0a0a" />
      <rect width="1024" height="1024" fill="url(#logoGreen)" />
      <rect width="1024" height="1024" fill="url(#logoPurple)" />
      <rect width="1024" height="1024" fill="url(#logoGrid)" />
      <g transform="translate(128, 128) scale(32)" fill="#ffffff">
        <path d="M 3 12 L 8 4 L 11 7 L 11 17 L 8 20 Z" />
        <path d="M 21 12 L 16 4 L 13 7 L 13 17 L 16 20 Z" />
      </g>
    </svg>
  );
}
