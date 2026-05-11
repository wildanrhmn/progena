import type { Tool, ToolResult } from "./types.js";

interface TavilyResponse {
  answer?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
}

const MAX_RESULTS = 5;
const TIMEOUT_MS = 25_000;

export interface WebSearchOptions {
  apiKey: string;
  endpoint?: string;
}

export function createWebSearchTool(opts: WebSearchOptions): Tool {
  const apiKey = opts.apiKey;
  const endpoint = opts.endpoint ?? "https://api.tavily.com/search";

  return {
    name: "web_search",
    description:
      "Search the public web for current information. Use this when the question requires recent news, current prices, or facts that may have changed since your training cutoff. Returns up to 5 result snippets with titles and URLs, plus a short synthesized answer from Tavily. Prefer specific queries over broad ones; rephrase if results are empty.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query. Be specific. Include dates, ticker symbols, or proper nouns when relevant.",
        },
      },
      required: ["query"],
    },
    async execute(args, ctx): Promise<ToolResult> {
      const query = String(args.query ?? "").trim();
      if (query.length === 0) {
        return { ok: false, summary: "empty query", error: "query is required" };
      }
      ctx.logger?.info?.("tool web_search", { query: query.slice(0, 120) });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            search_depth: "basic",
            max_results: MAX_RESULTS,
            include_answer: true,
            include_raw_content: false,
          }),
          signal: ctx.abortSignal ?? controller.signal,
        });

        if (!res.ok) {
          const body = await res.text();
          return {
            ok: false,
            summary: `Tavily error ${res.status}`,
            error: body.slice(0, 200),
          };
        }

        const json = (await res.json()) as TavilyResponse;
        const results = (json.results ?? []).slice(0, MAX_RESULTS);
        const lines: string[] = [];
        if (json.answer) lines.push(`Synthesis: ${json.answer.trim()}`);
        results.forEach((r, i) => {
          const snippet = (r.content ?? "").trim().replace(/\s+/g, " ").slice(0, 240);
          lines.push(`${i + 1}. ${r.title ?? "(no title)"} — ${snippet} [${r.url ?? ""}]`);
        });

        if (lines.length === 0) {
          return { ok: true, summary: "no results", data: { query, results: [] } };
        }
        return {
          ok: true,
          summary: lines.join("\n"),
          data: { query, answer: json.answer, results },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, summary: "web_search failed", error: message };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
