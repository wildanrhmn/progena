import { keccak256, toBytes } from "viem";

/**
 * On-chain `RoundData` only stores `keccak256(text)`. The plain text lives
 * off-chain. We keep a small static catalog for canonical demo rounds, plus
 * a localStorage layer so anyone who creates a round in the UI sees the
 * text back immediately and across reloads on the same device.
 */
const STATIC_ENTRIES: Array<{ text: string }> = [];

const STATIC_MAP = new Map<string, string>();
for (const e of STATIC_ENTRIES) {
  STATIC_MAP.set(keccak256(toBytes(e.text)).toLowerCase(), e.text);
}

const LS_KEY = "progena:round-questions";

function readStore(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(map: Record<string, string>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    // quota or disabled — silently ignore
  }
}

export function questionHashOf(text: string): `0x${string}` {
  return keccak256(toBytes(text));
}

export function questionTextOf(hash: string): string | undefined {
  const key = hash.toLowerCase();
  const fromLocal = readStore()[key];
  if (fromLocal) return fromLocal;
  return STATIC_MAP.get(key);
}

export function registerQuestion(text: string): `0x${string}` {
  const hash = questionHashOf(text);
  const store = readStore();
  store[hash.toLowerCase()] = text;
  writeStore(store);
  return hash;
}
