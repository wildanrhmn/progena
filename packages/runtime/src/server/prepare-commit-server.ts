import { createServer, type Server } from "node:http";
import type { Logger } from "../lib/logger.js";
import type { RoundRunner, PrepareCommitResult } from "../round/round-runner.js";

export interface PrepareCommitServerOptions {
  port: number;
  host?: string;
  roundRunner: RoundRunner;
  questionLookup: (
    roundId: bigint
  ) => Promise<{ question: string; questionHash: `0x${string}` } | null>;
  logger?: Logger;
}

interface PrepareCommitRequestBody {
  roundId?: string;
  agentId?: string;
  ownerAddress?: string;
}

interface JsonResponse {
  status: number;
  body: unknown;
}

export class PrepareCommitServer {
  private server?: Server;

  constructor(private readonly opts: PrepareCommitServerOptions) {}

  start(): void {
    const log = this.opts.logger?.child?.({ component: "prepare-commit-server" });
    this.server = createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        log?.error?.("handler crashed", {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "internal" }));
        }
      });
    });

    this.server.listen(this.opts.port, this.opts.host ?? "0.0.0.0", () => {
      log?.info?.("listening", {
        host: this.opts.host ?? "0.0.0.0",
        port: this.opts.port,
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }

  private async handle(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost`);

    if (req.method === "GET" && url.pathname === "/health") {
      this.send(res, { status: 200, body: { ok: true } });
      return;
    }

    if (req.method === "POST" && url.pathname === "/prepare-commit") {
      const requiredToken = process.env.RUNTIME_API_TOKEN;
      if (requiredToken) {
        const auth = req.headers.authorization ?? "";
        if (auth !== `Bearer ${requiredToken}`) {
          this.send(res, { status: 401, body: { error: "unauthorized" } });
          return;
        }
      }
      const body = await readJsonBody<PrepareCommitRequestBody>(req).catch(() => undefined);
      if (!body) {
        this.send(res, { status: 400, body: { error: "invalid json body" } });
        return;
      }
      const result = await this.handlePrepareCommit(body);
      this.send(res, result);
      return;
    }

    this.send(res, { status: 404, body: { error: "not found" } });
  }

  private async handlePrepareCommit(
    body: PrepareCommitRequestBody
  ): Promise<JsonResponse> {
    const log = this.opts.logger?.child?.({ component: "prepare-commit-server" });

    let roundId: bigint;
    let agentId: bigint;
    try {
      if (!body.roundId || !body.agentId) throw new Error("roundId and agentId required");
      roundId = BigInt(body.roundId);
      agentId = BigInt(body.agentId);
      if (roundId <= 0n || agentId <= 0n) throw new Error("ids must be > 0");
    } catch (err) {
      return {
        status: 400,
        body: { error: err instanceof Error ? err.message : "invalid ids" },
      };
    }

    const lookup = await this.opts.questionLookup(roundId);
    if (!lookup) {
      return {
        status: 404,
        body: { error: `no question text for round ${roundId}` },
      };
    }

    log?.info?.("prepare-commit request", {
      roundId: String(roundId),
      agentId: String(agentId),
      ownerAddress: body.ownerAddress,
    });

    try {
      const prep = await this.opts.roundRunner.prepareCommitForAgent(
        roundId,
        agentId,
        lookup.question
      );
      return {
        status: 200,
        body: serializePrepareResult(prep, lookup.questionHash),
      };
    } catch (err) {
      log?.error?.("prepare-commit failed", {
        roundId: String(roundId),
        agentId: String(agentId),
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        status: 500,
        body: { error: err instanceof Error ? err.message : "inference failed" },
      };
    }
  }

  private send(res: import("node:http").ServerResponse, response: JsonResponse): void {
    res.writeHead(response.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response.body));
  }
}

function readJsonBody<T>(req: import("node:http").IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw.length > 0 ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

function serializePrepareResult(
  prep: PrepareCommitResult,
  questionHash: `0x${string}`
): Record<string, unknown> {
  return {
    agentId: prep.agentId.toString(),
    prediction: prep.prediction,
    commitHash: prep.commitHash,
    nonce: prep.nonce,
    questionHash,
    reasoningPreview: prep.reasoningPreview,
    openclawReasoning: prep.openclawReasoning,
    toolCalls: prep.toolCalls,
    inferenceModel: prep.inferenceModel,
    inferenceIterations: prep.inferenceIterations,
  };
}
