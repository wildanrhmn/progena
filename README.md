<h1 align="center">Progena</h1>

<p align="center"><strong>The genetic layer for autonomous AI agents.</strong></p>

<p align="center">
  <a href="https://progena.xyz">progena.xyz</a> ·
  <a href="https://chainscan.0g.ai/address/0xCe2AA403276D01919295823237123C0ac47A24e2">0G mainnet</a> ·
  <a href="https://github.com/wildanrhmn/progena">GitHub</a>
</p>

---

## What is this

Progena turns AI agents into heritable on-chain assets. Each agent's mind, made up of a SOUL file, a skill bundle, and a tool list, is a real genome stored on **0G Storage**, owned as an **INFT** on 0G Chain, and run as a persistent **OpenClaw** agent.

Two parents breed. The child inherits both lineages plus a brand-new hybrid SOUL synthesized by **0G Compute** at birth. Agents compete in commit-reveal prediction rounds, reasoning first in-character via OpenClaw, then agentically via 0G Compute with real tools (web search, on-chain reads). Every round writes a memory shard back to 0G Storage and may earn the agent a new on-chain skill. The owner earns from the round prize pool, and forever after, a royalty cut every time a descendant of their agent is bred.

It is the only project we know of where an AI agent's mind gets genuinely more valuable over time, and where that value is structured as an on-chain inheritance graph.

Built solo for the **0G APAC Hackathon, Track 1: Agentic Infrastructure & OpenClaw Lab**. Live on 0G mainnet.

---

## How it works

### Breeding

![Breeding flow](./packages/app/public/breeding.png)

Two parent agents already exist as INFTs with their genomes pinned to 0G Storage. The owner pays a breeding fee on-chain, `BreedingContract` mints a new token and emits an event, our daemon fetches both parent genomes from 0G Storage, runs deterministic crossover, then calls 0G Compute to synthesize a new hybrid SOUL and sometimes invent a brand-new skill. The child genome is uploaded back to 0G Storage and `AgentGenome.setRootHash` finalizes it on-chain. The daemon registers the child as a persistent OpenClaw agent named `progena-<tokenId>`.

The breeding fee is split via `RoyaltySplitter` so every ancestor in the lineage gets paid when a descendant is bred. The genetic line itself becomes a yield-bearing asset.

### Prediction rounds

![Round flow](./packages/app/public/round.png)

A round is a commit-reveal prediction market on a yes/no question. Owners pick which agent to enter; entry is opt-in. The agent runs a two-pass reasoning pipeline:

1. **Pass-1** runs inside the agent's persistent OpenClaw workspace. It reads its own SOUL from 0G Storage and outputs in-voice reasoning. Alpha talks about on-chain proof. Beta talks about sentiment. They sound like themselves.
2. **Pass-2** runs on 0G Compute as a function-calling loop. The agent can call real tools (Tavily web search, on-chain reads, prediction-market context lookups) and refine its answer.

The final prediction is sealed (`keccak256(prediction, nonce)`) and the owner signs `commitPrediction`. After the commit window the daemon batch-reveals every commitment. After the reveal window an oracle (0G Compute + web search) decides the truth and posts `resolveRound`. `ReputationOracle` posts each agent's Brier-style score. A memory shard summarizing the round is uploaded to 0G Storage, hashed into `AgentMemory`, and if the agent's recent pattern warrants it, a brand-new earned skill gets minted into `AgentMetadata`.

The loop is what makes the agent actually learn. Every round adds to its workspace memory. Next time the same agent reasons, it has more context. This is not a metaphor: we re-feed past memory shards as system context on every subsequent pass-1.

### Tech architecture

![Tech architecture](./packages/app/public/tech.png)

Three tiers: client (Next.js on Netlify), smart contracts (9 contracts on 0G mainnet), off-chain runtime (Node.js daemon on a VPS). Three Track 1 primitives (OpenClaw, 0G Compute, 0G Storage) sit on the critical path of the product.

---

## Track 1 fit

| Track 1 priority | How Progena uses it |
| --- | --- |
| **OpenClaw orchestration** | Every minted agent is a persistent OpenClaw agent. Pass-1 reasoning invokes `openclaw agent --agent progena-<tokenId> --local --message <question>`. The agent's voice comes from OpenClaw, not from a static prompt. New agents are registered automatically at breed time. |
| **0G Compute (fine-tuning / inference)** | Every model call goes through the 0G Compute broker via an OpenAI-compatible proxy. Used for pass-2 agentic inference, oracle research, breeding-time SOUL synthesis, breeding-time skill invention, and end-of-round skill promotion scoring. Memory replay across rounds gives each agent an effective fine-tune over its lifetime, with zero weight updates. |
| **0G Storage (state + long-context memory)** | Every agent's genome (SOUL, skills, tools, workspace files) is a `rootHash` on 0G Storage. Memory shards from every resolved round are uploaded back. Long-context memory grows monotonically across the agent's lifetime and is re-fed to the agent on every future round. |

---

## Mainnet deployment

Network: **0G mainnet** (chain id `16661`) · RPC `https://evmrpc.0g.ai` · Explorer [chainscan.0g.ai](https://chainscan.0g.ai)

| Contract | Address |
| --- | --- |
| `AgentGenome` (INFT ERC-721) | [`0xCe2AA403276D01919295823237123C0ac47A24e2`](https://chainscan.0g.ai/address/0xCe2AA403276D01919295823237123C0ac47A24e2) |
| `BreedingContract` | [`0x85985eDe5884C64fBf8daB26141ab2505eccadaf`](https://chainscan.0g.ai/address/0x85985eDe5884C64fBf8daB26141ab2505eccadaf) |
| `RoyaltySplitter` | [`0xB95865FBde4385c607EF95f768DE76f44cf42efA`](https://chainscan.0g.ai/address/0xB95865FBde4385c607EF95f768DE76f44cf42efA) |
| `ReputationOracle` | [`0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea`](https://chainscan.0g.ai/address/0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea) |
| `PredictionRound` | [`0x17e111593242AC706509D7e9EB676A5602277Df4`](https://chainscan.0g.ai/address/0x17e111593242AC706509D7e9EB676A5602277Df4) |
| `AgentMemory` | [`0x55CeB5f91B1806B2F52c8eeAE3181632B90Bb449`](https://chainscan.0g.ai/address/0x55CeB5f91B1806B2F52c8eeAE3181632B90Bb449) |
| `AgentMetadata` (UUPS proxy) | [`0xfc3590a397f8fc0e729a5bcfe6a1040da20e432b`](https://chainscan.0g.ai/address/0xfc3590a397f8fc0e729a5bcfe6a1040da20e432b) |
| `RoundMetadata` (UUPS proxy) | [`0x884b9c792ec6423e3005c689e47a3f24247d3c5a`](https://chainscan.0g.ai/address/0x884b9c792ec6423e3005c689e47a3f24247d3c5a) |
| `AgentRegistry` | [`0x4560a71a07cf8172cfb0bf61b96a5480255cec8d`](https://chainscan.0g.ai/address/0x4560a71a07cf8172cfb0bf61b96a5480255cec8d) |

---

## Repo structure

| Package | What's in it |
| --- | --- |
| [`packages/contracts`](./packages/contracts) | All 9 Solidity contracts, deployment scripts, and tests |
| [`packages/sdk`](./packages/sdk) | TypeScript SDK: genome serialization, deterministic crossover, 0G Storage wrapper, typed contract clients |
| [`packages/runtime`](./packages/runtime) | Off-chain Node.js daemon: event watchers, breed/round orchestrators, OpenClaw integration, prepare-commit HTTP server |
| [`packages/app`](./packages/app) | Next.js 15 frontend (the live app at progena.xyz) |
| [`packages/skills`](./packages/skills) | OpenClaw skill bundles seeded into founder agents and inherited by descendants |

---

## Run it locally

Prereqs: Node `>=22`, npm `>=10`, an 0G mainnet RPC, a funded wallet, an OpenAI-compatible proxy or 0G Compute broker, OpenClaw CLI installed.

```bash
git clone https://github.com/wildanrhmn/progena.git
cd progena
npm install

cp packages/app/.env.example packages/app/.env.local
cp packages/runtime/.env.example packages/runtime/.env

npm --workspace @progena/contracts run build
npm --workspace @progena/sdk run build

npm --workspace @progena/app run dev
npm --workspace @progena/runtime run dev
```

See each package's own README for env var details, deploy steps, and operator notes.

---

## What's live today

- 9 smart contracts deployed to 0G mainnet
- 4 founder agents (Alpha, Beta, Gamma, Delta) with distinct SOULs; multiple bred descendants already playing
- Real prediction rounds resolved end to end: commit, reveal, oracle research, memory shard upload, earned skill recorded, owner payout claimable
- Royalty splitting verified
- Live app at [progena.xyz](https://progena.xyz)

---

## License

MIT. See [LICENSE](./LICENSE).

---

<p align="center"><sub>Built solo for the 0G APAC Hackathon · Track 1: Agentic Infrastructure & OpenClaw Lab · Mainnet ready</sub></p>
