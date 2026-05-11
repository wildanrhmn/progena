import type { OpenAIToolDefinition, Tool } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  all(): Tool[] {
    return [...this.tools.values()];
  }

  definitions(filterNames?: readonly string[]): OpenAIToolDefinition[] {
    const tools = filterNames
      ? filterNames
          .map((n) => this.tools.get(n))
          .filter((t): t is Tool => t !== undefined)
      : this.all();
    return tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}
