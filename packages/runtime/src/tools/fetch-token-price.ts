import type { Tool, ToolResult } from "./types.js";

const TIMEOUT_MS = 15_000;

const COINGECKO_IDS: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  og: "0g",
  "0g": "0g",
  doge: "dogecoin",
  dogecoin: "dogecoin",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  op: "optimism",
  optimism: "optimism",
  matic: "matic-network",
  polygon: "matic-network",
  bnb: "binancecoin",
  ada: "cardano",
  link: "chainlink",
  xrp: "ripple",
  usdt: "tether",
  usdc: "usd-coin",
};

function resolveId(symbol: string): string {
  const key = symbol.trim().toLowerCase();
  return COINGECKO_IDS[key] ?? key;
}

export function createFetchTokenPriceTool(): Tool {
  return {
    name: "fetch_token_price",
    description:
      "Fetch the current USD spot price for a crypto token via CoinGecko's free API. Accepts a ticker symbol (btc, eth, og, sol, usdc, ...) or a CoinGecko id (bitcoin, ethereum, 0g, ...). Returns price + 24h % change. Use when the question references a token price you need a current data point for.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Token ticker (e.g. 'btc') or CoinGecko id (e.g. 'bitcoin').",
        },
      },
      required: ["symbol"],
    },
    async execute(args, ctx): Promise<ToolResult> {
      const sym = String(args.symbol ?? "").trim();
      if (sym.length === 0) {
        return { ok: false, summary: "empty symbol", error: "symbol is required" };
      }
      const id = resolveId(sym);
      ctx.logger?.info?.("tool fetch_token_price", { symbol: sym, id });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const url = new URL("https://api.coingecko.com/api/v3/simple/price");
        url.searchParams.set("ids", id);
        url.searchParams.set("vs_currencies", "usd");
        url.searchParams.set("include_24hr_change", "true");
        url.searchParams.set("include_last_updated_at", "true");

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: ctx.abortSignal ?? controller.signal,
        });
        if (!res.ok) {
          return {
            ok: false,
            summary: `CoinGecko HTTP ${res.status}`,
            error: (await res.text()).slice(0, 200),
          };
        }
        const json = (await res.json()) as Record<
          string,
          { usd?: number; usd_24h_change?: number; last_updated_at?: number }
        >;
        const entry = json[id];
        if (!entry || typeof entry.usd !== "number") {
          return {
            ok: false,
            summary: `no price for "${sym}" (tried id "${id}")`,
            error: "not found",
          };
        }
        const price = entry.usd;
        const change = entry.usd_24h_change;
        const ts = entry.last_updated_at ? new Date(entry.last_updated_at * 1000).toISOString() : "n/a";
        const changeStr =
          typeof change === "number"
            ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}% 24h`
            : "24h change n/a";
        return {
          ok: true,
          summary: `${id} = $${price.toLocaleString("en-US", { maximumFractionDigits: 6 })} (${changeStr}, as of ${ts})`,
          data: { symbol: sym, id, priceUsd: price, change24hPct: change, updatedAt: ts },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, summary: "fetch_token_price failed", error: message };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
