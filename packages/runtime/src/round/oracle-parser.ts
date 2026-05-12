export function clampOutcome(n: number): number {
  if (!Number.isFinite(n)) return 5000;
  return Math.max(0, Math.min(10_000, Math.round(n)));
}

export function parseOracleOutcome(text: string): number {
  const strict = /final[_\s-]*answer\s*[:=]\s*(\d{1,5})\b/gi;
  let lastStrict: RegExpExecArray | null = null;
  for (let m = strict.exec(text); m; m = strict.exec(text)) lastStrict = m;
  if (lastStrict && lastStrict[1]) {
    const v = Number(lastStrict[1]);
    if (v >= 0 && v <= 10_000) return clampOutcome(v);
  }

  const loose = /(?:answer|outcome|prediction)\s*[:=]\s*(\d{1,5})\b/gi;
  let lastLoose: RegExpExecArray | null = null;
  for (let m = loose.exec(text); m; m = loose.exec(text)) lastLoose = m;
  if (lastLoose && lastLoose[1]) {
    const v = Number(lastLoose[1]);
    if (v >= 0 && v <= 10_000) return clampOutcome(v);
  }

  const finalLine = text.trim().split(/\r?\n/).slice(-3).join("\n");
  const matches = finalLine.replace(/[*_`]/g, "").match(/-?\d{1,5}(?:\.\d+)?/g) ?? [];
  for (const m of matches.reverse()) {
    const n = Number(m);
    if (Number.isFinite(n) && n >= 0 && n <= 10_000) return clampOutcome(n);
  }
  return 5000;
}
