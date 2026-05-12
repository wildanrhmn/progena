const ALIASES: Record<string, string> = {
  dune: "read_on_chain",
  etherscan: "read_on_chain",
  blockscout: "read_on_chain",
  chainscan: "read_on_chain",
  "chain-reader": "read_on_chain",
  read_on_chain: "read_on_chain",

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

  coingecko: "fetch_token_price",
  price: "fetch_token_price",
  prices: "fetch_token_price",
  ticker: "fetch_token_price",
  fetch_token_price: "fetch_token_price",

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
