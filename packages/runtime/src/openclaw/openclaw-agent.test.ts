import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Genome } from "@progena/sdk";
import { OpenClawAgent, type SpawnFn } from "./openclaw-agent.js";

const sample: Genome = {
  version: 1,
  manifest: { createdAt: 1, generation: 0 },
  workspace: {
    "SOUL.md": "I am a careful agent.",
    "skills/0g/SKILL.md": "use 0G",
  },
};

function fakeSpawn(stdout: string, stderr = "", code = 0): SpawnFn {
  return vi.fn(async () => ({ code, stdout, stderr }));
}

describe("OpenClawAgent", () => {
  it("materializes workspace before invoking openclaw", async () => {
    const calls: Array<{ bin: string; args: string[]; cwd: string }> = [];
    const spawnFn: SpawnFn = async (bin, args, options) => {
      calls.push({ bin, args, cwd: options.cwd });
      const soul = await readFile(join(options.cwd, "SOUL.md"), "utf8");
      expect(soul).toMatch(/careful agent/);
      return { code: 0, stdout: "PREDICTION: 7200", stderr: "" };
    };

    const agent = new OpenClawAgent({ genome: sample, spawnFn });
    const result = await agent.ask("Will BTC moon?");
    await agent.dispose();

    expect(result.text).toEqual("PREDICTION: 7200");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.bin).toEqual("openclaw");
    expect(calls[0]?.args).toEqual([
      "agent",
      "--message",
      "Will BTC moon?",
      "--thinking",
      "high",
    ]);
  });

  it("forwards a custom binary path and thinking level", async () => {
    const spawnFn = fakeSpawn("PREDICTION: 5000");
    const agent = new OpenClawAgent({
      genome: sample,
      spawnFn,
      openclawBin: "/usr/local/bin/openclaw",
      thinking: "medium",
    });
    await agent.ask("q");
    await agent.dispose();

    const call = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toEqual("/usr/local/bin/openclaw");
    expect(call[1]).toContain("--thinking");
    expect(call[1]).toContain("medium");
  });

  it("sets OPENCLAW_HOME / OPENCLAW_WORKSPACE in env to the workspace root", async () => {
    const spawnFn = fakeSpawn("PREDICTION: 5000");
    const agent = new OpenClawAgent({ genome: sample, spawnFn });
    await agent.ask("q");
    await agent.dispose();

    const call = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const env = (call[2] as { env: NodeJS.ProcessEnv; cwd: string }).env;
    const cwd = (call[2] as { env: NodeJS.ProcessEnv; cwd: string }).cwd;
    expect(env.OPENCLAW_HOME).toEqual(cwd);
    expect(env.OPENCLAW_WORKSPACE).toEqual(cwd);
  });

  it("captures stderr and exit code on non-zero exit", async () => {
    const spawnFn = fakeSpawn("", "boom: not found", 1);
    const agent = new OpenClawAgent({ genome: sample, spawnFn });
    const r = await agent.ask("q");
    await agent.dispose();

    expect(r.exitCode).toEqual(1);
    expect(r.stderr).toMatch(/boom/);
  });

  it("reuses the same workspace across multiple asks", async () => {
    const spawnFn = fakeSpawn("PREDICTION: 5000");
    const agent = new OpenClawAgent({ genome: sample, spawnFn });
    await agent.ask("q1");
    await agent.ask("q2");
    await agent.dispose();

    const calls = (spawnFn as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toEqual(2);
    expect((calls[0]![2] as { cwd: string }).cwd).toEqual((calls[1]![2] as { cwd: string }).cwd);
  });

  it("dispose cleans up the workspace dir", async () => {
    const spawnFn = fakeSpawn("PREDICTION: 5000");
    const agent = new OpenClawAgent({ genome: sample, spawnFn });
    await agent.ask("q");
    const cwd = ((spawnFn as ReturnType<typeof vi.fn>).mock.calls[0]![2] as { cwd: string }).cwd;
    await agent.dispose();

    await expect(readFile(join(cwd, "SOUL.md"), "utf8")).rejects.toThrow();
  });

  it("respects a caller-provided rootDir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ow-test-"));
    try {
      const spawnFn = fakeSpawn("PREDICTION: 5000");
      const agent = new OpenClawAgent({ genome: sample, spawnFn, workspaceRoot: dir });
      await agent.ask("q");
      const call = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect((call[2] as { cwd: string }).cwd).toEqual(dir);
      await agent.dispose();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("merges envOverrides on top of process.env and workspace vars", async () => {
    const spawnFn = fakeSpawn("PREDICTION: 5000");
    const agent = new OpenClawAgent({
      genome: sample,
      spawnFn,
      envOverrides: { ANTHROPIC_API_KEY: "abc", FOO: "bar" },
    });
    await agent.ask("q");
    await agent.dispose();

    const call = (spawnFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const env = (call[2] as { env: NodeJS.ProcessEnv }).env;
    expect(env.ANTHROPIC_API_KEY).toEqual("abc");
    expect(env.FOO).toEqual("bar");
    expect(env.OPENCLAW_HOME).toBeTruthy();
  });
});
