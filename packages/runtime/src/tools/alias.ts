// Maps tool names that may appear in an agent's TOOLS.md onto the canonical
// names registered in the runtime ToolRegistry. Existing founder agents listed
// things like "dune" or "etherscan" before the executable registry existed;
// this layer keeps those references useful instead of decorative.

const ALIASES: Record<string, string> = {
  // chain-reading aliases
  dune: "read_on_chain",
  etherscan: "read_on_chain",
  blockscout: "read_on_chain",
  chainscan: "read_on_chain",
  "chain-reader": "read_on_chain",
  read_on_chain: "read_on_chain",

  // web research aliases
  web: "web_search",
  search: "web_search",
  google: "web_search",
  brave: "web_search",
  tavily: "web_search",
  news: "web_search",
  farcaster: "web_search",
  twitter: "web_search",
  x: "web_search",
  web_search: "web_search",

  // price feed aliases
  coingecko: "fetch_token_price",
  price: "fetch_token_price",
  prices: "fetch_token_price",
  ticker: "fetch_token_price",
  fetch_token_price: "fetch_token_price",

  // market state aliases
  market: "fetch_market_state",
  round: "fetch_market_state",
  pool: "fetch_market_state",
  fetch_market_state: "fetch_market_state",
};

export function resolveToolName(raw: string): string | undefined {
  return ALIASES[raw.trim().toLowerCase()];
}

export function resolveToolList(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const resolved = resolveToolName(name);
    if (!resolved) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}
