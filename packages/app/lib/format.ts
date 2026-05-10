import { EXPLORER_URL } from "./chain";

export function shortAddress(addr: string | undefined | null, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function shortHash(hash: string | undefined | null, head = 8, tail = 6): string {
  return shortAddress(hash, head, tail);
}

export function explorerAddress(addr: string): string {
  return `${EXPLORER_URL}/address/${addr}`;
}

export function explorerToken(contract: string, tokenId: bigint | string | number): string {
  return `${EXPLORER_URL}/token/${contract}?a=${tokenId.toString()}`;
}

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function formatScore(raw: bigint | undefined): string {
  if (raw === undefined) return "—";
  const n = Number(raw) / 1_000_000;
  if (Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(3)}`;
}

export function formatTimestamp(unix: bigint | number | undefined): string {
  if (unix === undefined) return "—";
  const ms = Number(unix) * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelative(unix: bigint | number | undefined): string {
  if (unix === undefined) return "—";
  const seconds = Math.floor(Date.now() / 1000) - Number(unix);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const generationLabel = (gen: number | bigint): string => {
  const n = Number(gen);
  if (n === 0) return "Genesis";
  return `Gen ${n}`;
};
