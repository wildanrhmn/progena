import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process";
import type { Genome } from "@progena/sdk";
import type { Logger } from "../lib/logger.js";
import { materializeWorkspace, type MaterializedWorkspace } from "./materialize-workspace.js";

export interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type SpawnFn = (
  bin: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; cwd: string }
) => Promise<SpawnResult>;

export interface OpenClawAgentOptions {
  genome: Genome;
  recentMemoryLessons?: string[];
  workspaceRoot?: string;
  openclawBin?: string;
  thinking?: "low" | "medium" | "high";
  envOverrides?: Record<string, string>;
  spawnFn?: SpawnFn;
  logger?: Logger;
}

export interface AskResult {
  text: string;
  stderr: string;
  exitCode: number;
}

export class OpenClawAgent {
  private workspace: MaterializedWorkspace | null = null;

  constructor(private readonly opts: OpenClawAgentOptions) {}

  async ensureReady(): Promise<MaterializedWorkspace> {
    if (this.workspace) return this.workspace;
    this.workspace = await materializeWorkspace({
      genome: this.opts.genome,
      rootDir: this.opts.workspaceRoot,
      recentMemoryLessons: this.opts.recentMemoryLessons,
    });
    this.opts.logger?.debug?.("workspace materialized", { root: this.workspace.root });
    return this.workspace;
  }

  async ask(message: string): Promise<AskResult> {
    const ws = await this.ensureReady();
    const bin = this.opts.openclawBin ?? "openclaw";
    const args = ["infer", "model", "run", "--prompt", message];

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      OPENCLAW_HOME: ws.root,
      OPENCLAW_WORKSPACE: ws.root,
      ...this.opts.envOverrides,
    };

    this.opts.logger?.info?.("invoking openclaw", {
      bin,
      workspace: ws.root,
    });

    const spawn = this.opts.spawnFn ?? defaultSpawnFn;
    const result = await spawn(bin, args, { env, cwd: ws.root });

    if (result.code !== 0) {
      this.opts.logger?.warn?.("openclaw exited non-zero", {
        code: result.code,
        stderr: result.stderr.slice(0, 200),
      });
    }

    const text = extractCompletion(result.stdout);
    return { text, stderr: result.stderr, exitCode: result.code };
  }

  async dispose(): Promise<void> {
    if (this.workspace) {
      await this.workspace.cleanup();
      this.workspace = null;
    }
  }
}

function extractCompletion(stdout: string): string {
  const lines = stdout.split(/\r?\n/);
  const headerEnd = lines.findIndex((l) => /^outputs:\s*\d+/.test(l.trim()));
  if (headerEnd === -1) return stdout.trim();
  return lines
    .slice(headerEnd + 1)
    .join("\n")
    .trim();
}

const defaultSpawnFn: SpawnFn = (bin, args, options) =>
  new Promise<SpawnResult>((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      env: options.env,
      cwd: options.cwd,
      shell: process.platform === "win32",
    };
    const child = nodeSpawn(bin, args, spawnOptions);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
