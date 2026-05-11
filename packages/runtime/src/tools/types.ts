import type { Logger } from "../lib/logger.js";

export interface ToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolSchema;
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
}

export interface ToolExecutionContext {
  logger?: Logger;
  agentId?: bigint;
  roundId?: bigint;
  abortSignal?: AbortSignal;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  ok: boolean;
  durationMs: number;
}

export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolSchema;
  };
}
