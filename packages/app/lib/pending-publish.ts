const KEY = "progena:pending-publish";

export interface PendingPublish {
  roundId: string;
  text: string;
  createdAt: number;
}

interface PendingPublishMap {
  [roundId: string]: { text: string; createdAt: number };
}

function read(): PendingPublishMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PendingPublishMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: PendingPublishMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* */
  }
}

export function savePendingPublish(roundId: bigint, text: string): void {
  const map = read();
  map[roundId.toString()] = { text, createdAt: Date.now() };
  write(map);
}

export function getPendingPublish(
  roundId: bigint
): PendingPublish | undefined {
  const map = read();
  const entry = map[roundId.toString()];
  if (!entry) return undefined;
  return {
    roundId: roundId.toString(),
    text: entry.text,
    createdAt: entry.createdAt,
  };
}

export function clearPendingPublish(roundId: bigint): void {
  const map = read();
  delete map[roundId.toString()];
  write(map);
}
