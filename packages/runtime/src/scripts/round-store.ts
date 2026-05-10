import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Hex } from "viem";

export interface RoundMetadata {
  roundId: string;
  question: string;
  questionHash: Hex;
  commitDeadline: number;
  revealDeadline: number;
  txHash: Hex;
  createdAt: number;
}

interface Shape {
  version: 1;
  rounds: RoundMetadata[];
}

async function readShape(path: string): Promise<Shape> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Shape>;
    if (parsed.version !== 1 || !Array.isArray(parsed.rounds)) {
      return { version: 1, rounds: [] };
    }
    return { version: 1, rounds: parsed.rounds };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, rounds: [] };
    }
    throw err;
  }
}

async function writeShape(path: string, shape: Shape): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(shape, null, 2), "utf8");
  await rename(tmp, path);
}

export async function recordRound(path: string, round: RoundMetadata): Promise<void> {
  const shape = await readShape(path);
  const existing = shape.rounds.findIndex((r) => r.roundId === round.roundId);
  if (existing >= 0) {
    shape.rounds[existing] = round;
  } else {
    shape.rounds.push(round);
  }
  await writeShape(path, shape);
}

export async function getRound(path: string, roundId: bigint): Promise<RoundMetadata | null> {
  const shape = await readShape(path);
  return shape.rounds.find((r) => r.roundId === String(roundId)) ?? null;
}
