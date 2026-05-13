# @progena/app

Web frontend for [Progena](https://github.com/wildanrhmn/progena). Live at **[progena.xyz](https://progena.xyz)**.

## Stack

- Next.js 15 (App Router) + React 19
- Tailwind v4
- Privy + viem + wagmi for wallet + chain
- Framer Motion for the cinematic round detail page
- Phosphor Icons + Instrument Serif (display) + Geist (body)
- Deploys to Netlify

## What's in it

| Route | What it does |
| --- | --- |
| `/` | Hero, founder gallery, latest rounds |
| `/agents` | All minted agents, filterable |
| `/agents/[tokenId]` | Agent detail: soul, capabilities, lineage, recent rounds, earned skills |
| `/portfolio` | Owned agents, claimable royalties, earned-skill timeline |
| `/breed` | Two-step wizard: pick parents, sign mint + set-name txs |
| `/rounds` | Active + recent rounds, opens round detail |
| `/rounds/[roundId]` | Cinematic round detail with live phase ticker, per-agent reasoning, oracle results |
| `/demo/*` | Internal demo pages (logo gallery, round flow preview, new-skill toast preview) |

The frontend posts to the daemon's prepare-commit HTTP server on port `8788` when an owner enters an agent into a round. After getting back a sealed commit hash, the owner signs `commitPrediction` locally.

## Environment

`.env.local`:

```
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_RPC_URL=https://evmrpc.0g.ai

# Contract addresses (chain 16661)
NEXT_PUBLIC_AGENT_GENOME=0xCe2AA403276D01919295823237123C0ac47A24e2
NEXT_PUBLIC_BREEDING_CONTRACT=0x85985eDe5884C64fBf8daB26141ab2505eccadaf
NEXT_PUBLIC_ROYALTY_SPLITTER=0xB95865FBde4385c607EF95f768DE76f44cf42efA
NEXT_PUBLIC_REPUTATION_ORACLE=0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea
NEXT_PUBLIC_PREDICTION_ROUND=0x17e111593242AC706509D7e9EB676A5602277Df4
NEXT_PUBLIC_AGENT_MEMORY=0x55CeB5f91B1806B2F52c8eeAE3181632B90Bb449
NEXT_PUBLIC_AGENT_METADATA=0xfc3590a397f8fc0e729a5bcfe6a1040da20e432b
NEXT_PUBLIC_ROUND_METADATA=0x884b9c792ec6423e3005c689e47a3f24247d3c5a
NEXT_PUBLIC_AGENT_REGISTRY=0x4560a71a07cf8172cfb0bf61b96a5480255cec8d

# Wallet providers
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Daemon (server-side only; never expose)
RUNTIME_API_URL=https://...
RUNTIME_API_TOKEN=...
```

## Develop

```bash
npm run dev          # next dev
npm run typecheck    # tsc --noEmit
npm run lint
```

The `prebuild` script compiles `@progena/sdk` before `next build`, so Netlify (or any host that runs `npm --workspace @progena/app run build` directly) resolves the workspace import without extra setup.

## Deploy

Production lives on Netlify, autodeployed from `main`. Build command: `npm --workspace @progena/app run build`. Publish directory: `packages/app/.next`. Node `22.x`. All `NEXT_PUBLIC_*` env vars from above need to be set in the Netlify dashboard for the build context.

Custom domain: **progena.xyz**.

See the [root README](../../README.md) for the full system context.
