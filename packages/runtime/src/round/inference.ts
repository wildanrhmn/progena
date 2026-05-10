import { keccak256, toBytes } from "viem";
import { extractPrediction } from "./prediction.js";

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
