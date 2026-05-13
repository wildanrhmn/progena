# @progena/runtime

Off-chain Node.js daemon for [Progena](https://github.com/wildanrhmn/progena). One long-running process; pm2-managed in production.

## What it does

- **Breeding watcher** subscribes to `BreedingContract` events. On each new breed: fetches both parent genomes from 0G Storage, runs deterministic crossover (via `@progena/sdk`), calls 0G Compute to synthesize a hybrid SOUL plus (sometimes) a brand-new earned skill, uploads the child genome to 0G Storage, and finalizes the on-chain root hash. Then registers the new child as a persistent OpenClaw agent at `progena-<tokenId>`.
- **Round watcher** subscribes to `PredictionRound.RoundCreated`. Drives a state machine per round: `awaiting-commit` → `awaiting-reveal` → `revealing` → `awaiting-resolve` → `resolving` → `memorizing` → `promoting` → `done`. Owner-signed commits stay opt-in; the daemon only auto-reveals after the commit deadline and only auto-resolves via the oracle.
- **Prepare-commit HTTP server** on port `8788` (bearer auth). Frontends POST a round-id + agent-id; the daemon downloads the agent's genome from 0G Storage, runs OpenClaw pass-1 + 0G Compute pass-2 with real tool calls, and returns a sealed commit hash for the owner to sign locally.
- **Oracle** uses 0G Compute + Tavily web search to derive a yes/no verdict and posts `resolveRound`.
- **Memorize + promote** uploads a per-agent memory shard to 0G Storage on every resolved round, records the hash in `AgentMemory`, then evaluates whether the agent's recent pattern warrants a new earned skill (recorded in `AgentMetadata`).

## Environment

`.env` at the package root:

```
NETWORK=mainnet                                       # or galileo
RPC_URL=https://evmrpc.0g.ai
INDEXER_URL=...                                       # 0G Storage indexer
GENOME_WRITER_PRIVATE_KEY=0x...                       # daemon wallet
ADDRESSES_AGENT_GENOME=...
ADDRESSES_BREEDING_CONTRACT=...
ADDRESSES_PREDICTION_ROUND=...
ADDRESSES_REPUTATION_ORACLE=...
ADDRESSES_AGENT_MEMORY=...
ADDRESSES_AGENT_METADATA=...
ADDRESSES_ROUND_METADATA=...

OPENAI_PROXY_URL=http://127.0.0.1:8787/v1             # OpenAI-compat proxy in front of 0G Compute
OPENAI_PROXY_MODEL=deepseek/deepseek-chat-v3-0324
TAVILY_API_KEY=...                                    # required for oracle

PREPARE_COMMIT_PORT=8788
PREPARE_COMMIT_HOST=0.0.0.0
PREPARE_COMMIT_BEARER_TOKEN=...

LOG_LEVEL=info
```

OpenClaw CLI must be installed on the host. Daemon registers persistent agents at `~/.openclaw/progena/<tokenId>/`.

## Run

```bash
npm run dev                                           # tsx src/index.ts
```

Production (pm2):

```bash
pm2 start --name progena-runner npm -- start
pm2 logs progena-runner
```

## Scripts

Operator + recovery scripts under [`src/scripts/`](./src/scripts):

| Script | Use |
| --- | --- |
| `round-create.ts` | Create a new round (with question text) |
| `round-commit.ts` | Manual commit (debug only; production uses prepare-commit server) |
| `round-reveal.ts` | Force-reveal a stuck round |
| `round-resolve.ts` | Force-resolve a stuck round |
| `round-auto-resolve.ts` | Full automated reveal → oracle → resolve sweep |
| `round-memorize.ts` | Re-run memory shard upload for a round |
| `round-skill-promote.ts` | Re-run earned-skill promotion for a round |
| `openclaw-backfill.ts` | Register every existing on-chain agent as a persistent OpenClaw agent (run once, idempotent) |
| `compute-balance.ts` / `compute-withdraw.ts` | Inspect / withdraw daemon wallet from the 0G Compute broker |
| `genesis.ts` / `seed-genesis.ts` | Mint and seed the founder agents |

## State

Per-round commit storage at `state/commits.json` (file-backed `CommitStore`). Oracle attestation log at `state/oracle-attestations.json`. Workspaces at `~/.openclaw/progena/<tokenId>/`.

See the [root README](../../README.md) for the full system architecture.
