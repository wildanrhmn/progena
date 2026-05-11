export function clampOutcome(n: number): number {
  if (!Number.isFinite(n)) return 5000;
  return Math.max(0, Math.min(10_000, Math.round(n)));
}

/**
 * Extract the oracle's final answer (basis points 0-10000) from a model
 * response. Strict matching prevents stray dollar amounts or dates in the
 * reasoning from being captured.
 */
export function parseOracleOutcome(text: string): number {
  // 1. Strict FINAL_ANSWER: <int> directive, prefer the LAST occurrence.
  const strict = /final[_\s-]*answer\s*[:=]\s*(\d{1,5})\b/gi;
  let lastStrict: RegExpExecArray | null = null;
  for (let m = strict.exec(text); m; m = strict.exec(text)) lastStrict = m;
  if (lastStrict && lastStrict[1]) {
    const v = Number(lastStrict[1]);
    if (v >= 0 && v <= 10_000) return clampOutcome(v);
  }

  // 2. Looser labelled match (answer/outcome/prediction with colon or equals).
  const loose = /(?:answer|outcome|prediction)\s*[:=]\s*(\d{1,5})\b/gi;
  let lastLoose: RegExpExecArray | null = null;
  for (let m = loose.exec(text); m; m = loose.exec(text)) lastLoose = m;
  if (lastLoose && lastLoose[1]) {
    const v = Number(lastLoose[1]);
    if (v >= 0 && v <= 10_000) return clampOutcome(v);
  }

  // 3. Last-resort numeric scan limited to the final 3 lines, so prose
  //    dollar amounts ($81,029) and dates earlier in the response can't
  //    masquerade as the answer.
  const finalLine = text.trim().split(/\r?\n/).slice(-3).join("\n");
  const matches = finalLine.replace(/[*_`]/g, "").match(/-?\d{1,5}(?:\.\d+)?/g) ?? [];
  for (const m of matches.reverse()) {
    const n = Number(m);
    if (Number.isFinite(n) && n >= 0 && n <= 10_000) return clampOutcome(n);
  }
  return 5000;
}
