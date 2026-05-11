import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Logger } from "../lib/logger.js";
import type {
  OpenAIToolDefinition,
  Tool,
  ToolCallRecord,
  ToolExecutionContext,
  ToolResult,
} from "../tools/types.js";
import type { ToolRegistry } from "../tools/registry.js";

export interface AgenticInferenceRequest {
  systemPrompt: string;
  userPrompt: string;
  toolNames?: readonly string[];
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  context?: ToolExecutionContext;
}

export interface AgenticInferenceResponse {
  finalText: string;
  toolCalls: ToolCallRecord[];
  model: string;
  iterations: number;
}

export interface AgenticInferenceOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  registry: ToolRegistry;
  logger?: Logger;
}

const DEFAULT_MAX_ITERATIONS = 6;
const SUMMARY_CAP = 1600;

export function createAgenticInferenceClient(opts: AgenticInferenceOptions) {
  const client = new OpenAI({
    baseURL: opts.baseUrl,
    apiKey: opts.apiKey ?? "no-op",
  });

  async function runTool(
    name: string,
    args: Record<string, unknown>,
    execCtx: ToolExecutionContext
  ): Promise<{ tool: Tool | undefined; result: ToolResult; durationMs: number }> {
    const tool = opts.registry.get(name);
    const t0 = Date.now();
    if (!tool) {
      return {
        tool: undefined,
        result: { ok: false, summary: `tool not registered: ${name}`, error: "unknown_tool" },
        durationMs: 0,
      };
    }
    try {
      const result = await tool.execute(args, execCtx);
      return { tool, result, durationMs: Date.now() - t0 };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        tool,
        result: { ok: false, summary: `${name} threw`, error: message.split("\n")[0] },
        durationMs: Date.now() - t0,
      };
    }
  }

  function toolDefsFor(names: readonly string[] | undefined): ChatCompletionTool[] | undefined {
    if (!names || names.length === 0) return undefined;
    const defs: OpenAIToolDefinition[] = opts.registry.definitions(names);
    if (defs.length === 0) return undefined;
    return defs as unknown as ChatCompletionTool[];
  }

  async function run(req: AgenticInferenceRequest): Promise<AgenticInferenceResponse> {
    const log = opts.logger?.child?.({ component: "agentic-inference" }) ?? opts.logger;
    const maxIters = req.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const tools = toolDefsFor(req.toolNames);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userPrompt },
    ];
    const toolCalls: ToolCallRecord[] = [];
    const execCtx: ToolExecutionContext = req.context ?? {};

    let iteration = 0;
    let finalText = "";

    while (iteration < maxIters) {
      iteration += 1;
      log?.info?.("inference turn", {
        iteration,
        toolCount: tools?.length ?? 0,
        messages: messages.length,
      });

      const completion = await client.chat.completions.create({
        model: opts.model,
        messages,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 900,
        tools,
        tool_choice: tools && iteration === 1 ? "auto" : tools ? "auto" : undefined,
      });

      const choice = completion.choices[0];
      const msg = choice?.message;
      if (!msg) break;

      const assistantMsg: ChatCompletionMessageParam = {
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: msg.tool_calls,
      };
      messages.push(assistantMsg);

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        finalText = msg.content ?? "";
        break;
      }

      for (const call of calls) {
        if (call.type !== "function") continue;
        const name = call.function.name;
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          parsedArgs = {};
        }
        const { result, durationMs } = await runTool(name, parsedArgs, execCtx);
        const summary = (result.summary ?? "").slice(0, SUMMARY_CAP);
        toolCalls.push({
          tool: name,
          args: parsedArgs,
          summary,
          ok: result.ok,
          durationMs,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result.ok ? summary : `ERROR: ${result.error ?? "unknown"}`,
        });
      }

      if (calls.length === 0) break;
    }

    if (!finalText && iteration === maxIters) {
      log?.warn?.("reached max iterations without final answer", { iteration });
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      finalText = (lastAssistant?.content as string | null | undefined) ?? "";
    }

    return {
      finalText,
      toolCalls,
      model: opts.model,
      iterations: iteration,
    };
  }

  return { run };
}

export type AgenticInferenceClient = ReturnType<typeof createAgenticInferenceClient>;
