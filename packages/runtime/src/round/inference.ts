import { keccak256, toBytes } from "viem";
import { extractPrediction } from "./prediction.js";
import type { BrokerContext } from "../compute/index.js";
import { complete as zgComplete } from "../compute/index.js";
import type { Logger } from "../lib/logger.js";

export interface InferenceRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface InferenceResponse {
  text: string;
  model?: string;
}

export interface InferenceClient {
  complete(req: InferenceRequest): Promise<InferenceResponse>;
}

export interface OpenAIChatLike {
  chat: {
    completions: {
      create(params: {
        model: string;
        messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
        temperature?: number;
        max_tokens?: number;
      }): Promise<{
        model: string;
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

export interface OpenAIInferenceOptions {
  client: OpenAIChatLike;
  defaultModel?: string;
}

export function createOpenAIInferenceClient(opts: OpenAIInferenceOptions): InferenceClient {
  const fallbackModel = opts.defaultModel ?? "deepseek-chat-v3";
  return {
    async complete(req) {
      const completion = await opts.client.chat.completions.create({
        model: req.model ?? fallbackModel,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        temperature: req.temperature ?? 0.3,
        max_tokens: req.maxTokens ?? 512,
      });
      const text = completion.choices[0]?.message?.content ?? "";
      return { text, model: completion.model };
    },
  };
}

export interface OpenClawInferenceOptions {
  openclawBin?: string;
  logger?: Logger;
}

export function createOpenClawInferenceClient(
  opts: OpenClawInferenceOptions = {}
): InferenceClient {
  return {
    async complete(req) {
      const { spawn } = await import("node:child_process");
      const bin = opts.openclawBin ?? "openclaw";
      const prompt = `${req.systemPrompt}\n\n${req.userPrompt}`;
      opts.logger?.info?.("invoking openclaw", { bin });
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(
          bin,
          ["infer", "model", "run", "--prompt", prompt],
          { stdio: ["ignore", "pipe", "pipe"] }
        );
        let out = "";
        let err = "";
        child.stdout?.on("data", (chunk: Buffer) => {
          out += chunk.toString("utf8");
        });
        child.stderr?.on("data", (chunk: Buffer) => {
          err += chunk.toString("utf8");
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code !== 0) {
            opts.logger?.warn?.("openclaw non-zero exit", {
              code,
              stderr: err.slice(0, 200),
            });
          }
          resolve(out);
        });
      });
      const lines = stdout.split(/\r?\n/);
      const headerEnd = lines.findIndex((l) =>
        /^outputs:\s*\d+/.test(l.trim())
      );
      const text =
        headerEnd === -1
          ? stdout.trim()
          : lines.slice(headerEnd + 1).join("\n").trim();
      return { text, model: "openclaw/custom-127-0-0-1-8787" };
    },
  };
}

export interface ZGComputeInferenceOptions {
  ctx: BrokerContext;
  providerAddress: string;
  logger?: Logger;
}

export function createZGComputeInferenceClient(
  opts: ZGComputeInferenceOptions
): InferenceClient {
  return {
    async complete(req) {
      const result = await zgComplete(
        opts.ctx,
        {
          providerAddress: opts.providerAddress,
          messages: [
            { role: "system", content: req.systemPrompt },
            { role: "user", content: req.userPrompt },
          ],
          temperature: req.temperature ?? 0.3,
          maxTokens: req.maxTokens ?? 512,
        },
        opts.logger
      );
      return { text: result.text, model: result.model };
    },
  };
}

export interface StubInferenceOptions {
  reasoningPrefix?: string;
  bias?: (systemPrompt: string) => number;
}

export function createStubInferenceClient(opts: StubInferenceOptions = {}): InferenceClient {
  const reasoningPrefix =
    opts.reasoningPrefix ??
    "Stub inference (no LLM call). Derived deterministically from agent + question.";

  return {
    async complete(req) {
      const seed = keccak256(toBytes(`${req.systemPrompt}\n###\n${req.userPrompt}`));
      const slice = seed.slice(2, 10);
      const u32 = parseInt(slice, 16) >>> 0;
      const raw = u32 % 10_001;
      const biasOffset = opts.bias ? Math.round(opts.bias(req.systemPrompt)) : 0;
      let prediction = raw + biasOffset;
      if (prediction < 0) prediction = 0;
      if (prediction > 10_000) prediction = 10_000;
      const text = `${reasoningPrefix}\nPREDICTION: ${prediction}`;
      return { text, model: "stub" };
    },
  };
}

export async function inferAndExtract(
  client: InferenceClient,
  req: InferenceRequest
): Promise<{ prediction: number; raw: InferenceResponse }> {
  const raw = await client.complete(req);
  const prediction = extractPrediction(raw.text);
  return { prediction, raw };
}
