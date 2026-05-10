import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Genome } from "@progena/sdk";
import { materializeWorkspace } from "./materialize-workspace.js";

const sample: Genome = {
  version: 1,
  manifest: { createdAt: 1_700_000_000, generation: 0 },
  workspace: {
    "SOUL.md": "I am Alpha.",
    "TOOLS.md": "polymarket\netherscan",
    "skills/0g/SKILL.md": "0G inference and storage",
    "skills/onchain-analyst/SKILL.md": "Read on-chain data",
  },
};

const cleanupRoots: string[] = [];

afterEach(async () => {
  while (cleanupRoots.length > 0) {
    const r = cleanupRoots.pop()!;
    await rm(r, { recursive: true, force: true });
  }
});

describe("materializeWorkspace", () => {
  it("writes every workspace file under the root", async () => {
    const ws = await materializeWorkspace({ genome: sample });
    cleanupRoots.push(ws.root);

    const soul = await readFile(join(ws.root, "SOUL.md"), "utf8");
    expect(soul).toEqual("I am Alpha.");

    const tools = await readFile(join(ws.root, "TOOLS.md"), "utf8");
    expect(tools).toEqual("polymarket\netherscan");

    const skill = await readFile(join(ws.root, "skills/0g/SKILL.md"), "utf8");
    expect(skill).toEqual("0G inference and storage");
  });

  it("creates intermediate directories for nested paths", async () => {
    const ws = await materializeWorkspace({ genome: sample });
    cleanupRoots.push(ws.root);

    const dir = await stat(join(ws.root, "skills/onchain-analyst"));
    expect(dir.isDirectory()).toBe(true);
  });

  it("writes a progena.json manifest with parent + generation", async () => {
    const bredGenome: Genome = {
      version: 1,
      manifest: {
        createdAt: 1_700_000_000,
        generation: 2,
        parents: [`0x${"a".repeat(64)}`, `0x${"b".repeat(64)}`],
      },
      workspace: { "SOUL.md": "child" },
    };
    const ws = await materializeWorkspace({ genome: bredGenome });
    cleanupRoots.push(ws.root);

    const manifest = JSON.parse(await readFile(join(ws.root, "progena.json"), "utf8"));
    expect(manifest.generation).toEqual(2);
    expect(manifest.parents).toHaveLength(2);
  });

  it("includes recent memory lessons as a digest under memory/", async () => {
    const ws = await materializeWorkspace({
      genome: sample,
      recentMemoryLessons: [
        "I underweighted on-chain whale flow last round.",
        "Sentiment lagged price; trust on-chain on multi-day horizon.",
      ],
    });
    cleanupRoots.push(ws.root);

    const digest = await readFile(join(ws.root, "memory/recent-lessons.md"), "utf8");
    expect(digest).toMatch(/Recent lessons/);
    expect(digest).toMatch(/whale flow/);
    expect(digest).toMatch(/multi-day horizon/);
  });

  it("uses the provided rootDir when supplied", async () => {
    const dir = await mkdtemp(join(tmpdir(), "custom-progena-"));
    cleanupRoots.push(dir);
    const ws = await materializeWorkspace({ genome: sample, rootDir: dir });
    expect(ws.root).toEqual(dir);
  });

  it("cleanup removes the workspace", async () => {
    const ws = await materializeWorkspace({ genome: sample });
    await ws.cleanup();
    await expect(stat(ws.root)).rejects.toThrow();
  });

  it("handles an empty workspace gracefully", async () => {
    const empty: Genome = {
      version: 1,
      manifest: { createdAt: 1, generation: 0 },
      workspace: {},
    };
    const ws = await materializeWorkspace({ genome: empty });
    cleanupRoots.push(ws.root);
    const manifest = JSON.parse(await readFile(join(ws.root, "progena.json"), "utf8"));
    expect(manifest).toBeTruthy();
  });
});
