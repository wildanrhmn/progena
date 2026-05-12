import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Hex } from "viem";
import type { ToolCallRecord } from "../tools/types.js";

export interface StoredCommitment {
  roundId: string;
  agentId: string;
  prediction: number;
  nonce: Hex;
  commitHash: Hex;
  committedAt: number;
  commitTxHash?: Hex;
  revealed: boolean;
  revealTxHash?: Hex;
  inferenceModel?: string;
  inferenceIterations?: number;
  toolCalls?: ToolCallRecord[];
  reasoningPreview?: string;
  openclawReasoning?: string;
}

export interface CommitStore {
  save(commitment: StoredCommitment): Promise<void>;
  get(roundId: bigint, agentId: bigint): Promise<StoredCommitment | null>;
  listForRound(roundId: bigint): Promise<StoredCommitment[]>;
  markRevealed(roundId: bigint, agentId: bigint, revealTxHash: Hex): Promise<void>;
}

interface StoreShape {
  version: 1;
  commitments: StoredCommitment[];
}

function key(roundId: bigint | string, agentId: bigint | string): string {
  return `${String(roundId)}:${String(agentId)}`;
}

async function readStore(path: string): Promise<StoreShape> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    if (parsed.version !== 1 || !Array.isArray(parsed.commitments)) {
      return { version: 1, commitments: [] };
    }
    return { version: 1, commitments: parsed.commitments };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, commitments: [] };
    }
    throw err;
  }
}

async function writeStore(path: string, store: StoreShape): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await rename(tmp, path);
}

export function createFileCommitStore(path: string): CommitStore {
  return {
    async save(commitment) {
      const store = await readStore(path);
      const existingIdx = store.commitments.findIndex(
        (c) => key(c.roundId, c.agentId) === key(commitment.roundId, commitment.agentId)
      );
      if (existingIdx >= 0) {
        store.commitments[existingIdx] = commitment;
      } else {
        store.commitments.push(commitment);
      }
      await writeStore(path, store);
    },

    async get(roundId, agentId) {
      const store = await readStore(path);
      return (
        store.commitments.find(
          (c) => key(c.roundId, c.agentId) === key(roundId, agentId)
        ) ?? null
      );
    },

    async listForRound(roundId) {
      const store = await readStore(path);
      return store.commitments.filter((c) => c.roundId === String(roundId));
    },

    async markRevealed(roundId, agentId, revealTxHash) {
      const store = await readStore(path);
      const found = store.commitments.find(
        (c) => key(c.roundId, c.agentId) === key(roundId, agentId)
      );
      if (!found) {
        throw new Error(
          `commit store: no commitment found for round=${roundId} agent=${agentId}`
        );
      }
      found.revealed = true;
      found.revealTxHash = revealTxHash;
      await writeStore(path, store);
    },
  };
}

export function createInMemoryCommitStore(): CommitStore {
  const data = new Map<string, StoredCommitment>();
  return {
    async save(c) {
      data.set(key(c.roundId, c.agentId), c);
    },
    async get(r, a) {
      return data.get(key(r, a)) ?? null;
    },
    async listForRound(r) {
      return [...data.values()].filter((c) => c.roundId === String(r));
    },
    async markRevealed(r, a, tx) {
      const found = data.get(key(r, a));
      if (!found) throw new Error(`commit store: no commitment for round=${r} agent=${a}`);
      found.revealed = true;
      found.revealTxHash = tx;
    },
  };
}
