import { MAX_PREDICTION, MIN_PREDICTION } from "./commit.js";

export class PredictionParseError extends Error {
  constructor(public readonly raw: string, message: string) {
    super(message);
    this.name = "PredictionParseError";
  }
}

const EXPLICIT_LINE_PATTERNS: RegExp[] = [
  /(?:^|\n)\s*PREDICTION\s*[:=]\s*(-?\d+)/i,
  /(?:^|\n)\s*FINAL\s*PREDICTION\s*[:=]\s*(-?\d+)/i,
  /(?:^|\n)\s*ANSWER\s*[:=]\s*(-?\d+)/i,
];

const PROBABILITY_PATTERN = /(\d{1,3}(?:\.\d+)?)\s*%/;

export function extractPrediction(text: string): number {
  if (!text || text.trim().length === 0) {
    throw new PredictionParseError(text, "empty inference output");
  }

  for (const pattern of EXPLICIT_LINE_PATTERNS) {
    const m = text.match(pattern);
    if (m && m[1] !== undefined) {
      return clampInteger(parseInt(m[1], 10));
    }
  }

  const pct = text.match(PROBABILITY_PATTERN);
  if (pct && pct[1] !== undefined) {
    const value = parseFloat(pct[1]);
    if (!Number.isNaN(value) && value >= 0 && value <= 100) {
      return clampInteger(Math.round(value * 100));
    }
  }

  const fallback = text.match(/(\d{1,5})\s*$/);
  if (fallback && fallback[1] !== undefined) {
    return clampInteger(parseInt(fallback[1], 10));
  }

  throw new PredictionParseError(text, "could not extract a prediction number");
}

function clampInteger(value: number): number {
  if (Number.isNaN(value)) {
    throw new PredictionParseError(String(value), "parsed NaN");
  }
  if (value < MIN_PREDICTION) return MIN_PREDICTION;
  if (value > MAX_PREDICTION) return MAX_PREDICTION;
  return Math.round(value);
}
