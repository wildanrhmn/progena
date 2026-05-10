import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Hex } from "viem";
import {
  createFileCommitStore,
  createInMemoryCommitStore,
  type StoredCommitment,
} from "./commit-store.js";

const HASH_A = `0x${"a".repeat(64)}` as Hex;
const HASH_B = `0x${"b".repeat(64)}` as Hex;
const NONCE_A = `0x${"01".repeat(32)}` as Hex;
const TX_A = `0x${"c".repeat(64)}` as Hex;
const TX_R = `0x${"d".repeat(64)}` as Hex;

function commitment(overrides: Partial<StoredCommitment> = {}): StoredCommitment {
  return {
    roundId: "1",
    agentId: "1",
    prediction: 7000,
    nonce: NONCE_A,
    commitHash: HASH_A,
    committedAt: 1_700_000_000,
    revealed: false,
    ...overrides,
  };
}

describe("CommitStore (in-memory and file impls share contract)", () => {
  for (const variant of ["memory", "file"] as const) {
    describe(variant, () => {
      let storePath: string;
      let dir: string | undefined;

      let store: ReturnType<typeof createInMemoryCommitStore>;

      beforeEach(async () => {
        if (variant === "file") {
          dir = await mkdtemp(join(tmpdir(), "progena-commit-"));
          storePath = join(dir, "commits.json");
          store = createFileCommitStore(storePath);
        } else {
          storePath = "(in-memory)";
          store = createInMemoryCommitStore();
        }
      });

      afterEach(async () => {
        if (dir) {
          await rm(dir, { recursive: true, force: true });
          dir = undefined;
        }
      });

      it("save then get roundtrips", async () => {
        await store.save(commitment());
        const loaded = await store.get(1n, 1n);
        expect(loaded).toEqual(commitment());
      });

      it("returns null for unknown commitment", async () => {
        const loaded = await store.get(99n, 99n);
        expect(loaded).toBeNull();
      });

      it("save overwrites an existing entry for the same (round, agent)", async () => {
        await store.save(commitment({ prediction: 5000 }));
        await store.save(commitment({ prediction: 8500, commitTxHash: TX_A }));

        const loaded = await store.get(1n, 1n);
        expect(loaded?.prediction).toEqual(8500);
        expect(loaded?.commitTxHash).toEqual(TX_A);
      });

      it("listForRound returns all entries for that round", async () => {
        await store.save(commitment({ agentId: "1", commitHash: HASH_A }));
        await store.save(commitment({ agentId: "2", commitHash: HASH_B }));
        await store.save(commitment({ roundId: "2", agentId: "1", commitHash: HASH_A }));

        const list = await store.listForRound(1n);
        expect(list).toHaveLength(2);
        expect(list.map((c) => c.agentId).sort()).toEqual(["1", "2"]);
      });

      it("markRevealed flips the flag and stores tx hash", async () => {
        await store.save(commitment());
        await store.markRevealed(1n, 1n, TX_R);

        const loaded = await store.get(1n, 1n);
        expect(loaded?.revealed).toEqual(true);
        expect(loaded?.revealTxHash).toEqual(TX_R);
      });

      it("markRevealed throws when no commitment exists", async () => {
        await expect(store.markRevealed(7n, 7n, TX_R)).rejects.toThrow(/no commitment/);
      });
    });
  }
});

describe("createFileCommitStore", () => {
  let dir: string;
  let storePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "progena-commit-"));
    storePath = join(dir, "nested", "commits.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates intermediate directories on first write", async () => {
    const store = createFileCommitStore(storePath);
    await store.save(commitment());

    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toEqual(1);
    expect(parsed.commitments).toHaveLength(1);
  });

  it("survives across new store handles (persistence)", async () => {
    await createFileCommitStore(storePath).save(commitment());

    const reopened = createFileCommitStore(storePath);
    const loaded = await reopened.get(1n, 1n);
    expect(loaded).not.toBeNull();
    expect(loaded?.commitHash).toEqual(HASH_A);
  });

  it("throws on malformed existing file rather than swallowing it", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(dirname(storePath), { recursive: true });
    await writeFile(storePath, "not valid json", "utf8");

    const store = createFileCommitStore(storePath);
    await expect(store.get(1n, 1n)).rejects.toThrow();
  });
});
