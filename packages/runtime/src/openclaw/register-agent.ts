import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Genome } from "@progena/sdk";
import { materializeWorkspace } from "./materialize-workspace.js";
import type { Logger } from "../lib/logger.js";

export interface RegisterAgentOptions {
  tokenId: bigint;
  genome: Genome;
  recentMemoryLessons?: string[];
  openclawBin?: string;
  modelId?: string;
  workspacesRoot?: string;
  logger?: Logger;
}

export interface RegisteredAgent {
  agentName: string;
  workspaceDir: string;
  created: boolean;
  alreadyExisted: boolean;
}

const DEFAULT_MODEL =
  "custom-127-0-0-1-8787/deepseek/deepseek-chat-v3-0324";

export function agentNameForToken(tokenId: bigint): string {
  return `progena-${tokenId.toString()}`;
}

export function workspaceDirForToken(
  tokenId: bigint,
  workspacesRoot?: string
): string {
  const root =
    workspacesRoot ?? join(homedir(), ".openclaw", "progena");
  return join(root, tokenId.toString());
}

export async function registerOpenClawAgent(
  opts: RegisterAgentOptions
): Promise<RegisteredAgent> {
  const bin = opts.openclawBin ?? "openclaw";
  const modelId = opts.modelId ?? DEFAULT_MODEL;
  const agentName = agentNameForToken(opts.tokenId);
  const workspaceDir = workspaceDirForToken(opts.tokenId, opts.workspacesRoot);
  const log = opts.logger?.child?.({
    component: "openclaw-register",
    tokenId: opts.tokenId.toString(),
    agentName,
  });

  log?.info?.("materializing persistent workspace", { workspaceDir });
  await materializeWorkspace({
    genome: opts.genome,
    rootDir: workspaceDir,
    recentMemoryLessons: opts.recentMemoryLessons,
  });

  const args = [
    "agents",
    "add",
    agentName,
    "--non-interactive",
    "--workspace",
    workspaceDir,
    "--model",
    modelId,
  ];

  log?.info?.("invoking openclaw agents add", { bin, args: args.join(" ") });

  return new Promise<RegisteredAgent>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      const combined = `${stdout}\n${stderr}`;
      if (code === 0) {
        log?.info?.("openclaw agent registered");
        resolve({
          agentName,
          workspaceDir,
          created: true,
          alreadyExisted: false,
        });
        return;
      }
      if (/already exists/i.test(combined)) {
        log?.info?.("openclaw agent already registered, skipping");
        resolve({
          agentName,
          workspaceDir,
          created: false,
          alreadyExisted: true,
        });
        return;
      }
      log?.warn?.("openclaw agents add failed", {
        code,
        stderr: stderr.slice(0, 400),
      });
      reject(
        new Error(
          `openclaw agents add ${agentName} failed (exit ${code}): ${stderr.slice(0, 200)}`
        )
      );
    });
  });
}
