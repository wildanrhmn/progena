import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletion,
} from "openai/resources/chat/completions.js";
import type { BrokerContext } from "./broker.js";
import type { Logger } from "../lib/logger.js";

export interface InferenceRequest {
  providerAddress: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
}

export interface InferenceResult {
  text: string;
  completionId: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

/**
 * Single-shot chat completion against a 0G Compute provider. Handles
 * service metadata lookup, broker-signed headers, OpenAI-compatible
 * request shape, and post-response settlement.
 */
export async function complete(
  ctx: BrokerContext,
  req: InferenceRequest,
  logger?: Logger
): Promise<InferenceResult> {
  const meta = await ctx.broker.inference.getServiceMetadata(req.providerAddress);
  const { endpoint, model } = meta as { endpoint: string; model: string };

  const promptForSignature = req.messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n");

  const headers = await ctx.broker.inference.getRequestHeaders(
    req.providerAddress,
    promptForSignature
  );

  logger?.info?.("compute → inference", {
    provider: req.providerAddress,
    endpoint,
    model,
    messageCount: req.messages.length,
  });

  const openai = new OpenAI({ baseURL: endpoint, apiKey: "unused" });
  const completion = (await openai.chat.completions.create(
    {
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
    },
    { headers: headers as unknown as Record<string, string> }
  )) as ChatCompletion;

  const choice = completion.choices?.[0];
  const message = choice?.message as
    | { content?: string | null; reasoning_content?: string | null }
    | undefined;
  // Reasoning models (GLM, DeepSeek-R1, etc.) sometimes return text in
  // `reasoning_content` with `content` empty. Fall back to whichever is set.
  const content = message?.content ?? "";
  const reasoning = message?.reasoning_content ?? "";
  const text = (content.length > 0 ? content : reasoning).trim();

  try {
    await ctx.broker.inference.processResponse(
      req.providerAddress,
      completion.id,
      text
    );
  } catch (err) {
    logger?.warn?.("processResponse failed (response still valid)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    text,
    completionId: completion.id,
    model,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : null,
  };
}

export interface ChatServiceSummary {
  provider: string;
  model: string;
  serviceType: string;
  url?: string;
  inputPrice?: string;
  outputPrice?: string;
}

export async function listChatServices(
  ctx: BrokerContext
): Promise<ChatServiceSummary[]> {
  const services = (await ctx.broker.inference.listService()) as unknown as Array<
    Record<string, unknown>
  >;
  return services.map((s) => ({
    provider: String(s.provider ?? s.providerAddress ?? ""),
    model: String(s.model ?? ""),
    serviceType: String(s.serviceType ?? s.type ?? ""),
    url: s.url as string | undefined,
    inputPrice:
      s.inputPrice !== undefined ? String(s.inputPrice) : undefined,
    outputPrice:
      s.outputPrice !== undefined ? String(s.outputPrice) : undefined,
  }));
}

const CHAT_TYPE_KEYWORDS = ["chatbot", "chat", "llm", "text"];

// Ordered by demo preference. DeepSeek v3 is fast, cheap, and emits plain
// content (no reasoning_content quirks). GLM-5.1 second. Others last.
const MODEL_PREFERENCE = [
  /deepseek.*chat/i,
  /deepseek.*v3/i,
  /glm-?5\.1/i,
  /qwen.*30b/i,
  /gpt-?5/i,
  /glm-?5/i,
];

function isChatType(t: string): boolean {
  const low = t.toLowerCase();
  if (!low) return true;
  return CHAT_TYPE_KEYWORDS.some((k) => low.includes(k));
}

export function pickChatService(
  services: ChatServiceSummary[]
): ChatServiceSummary | undefined {
  const chats = services.filter((s) => isChatType(s.serviceType));
  for (const pattern of MODEL_PREFERENCE) {
    const match = chats.find((s) => pattern.test(s.model));
    if (match) return match;
  }
  return chats[0];
}
