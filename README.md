# Progena

The genetic layer for autonomous AI agents.

Progena lets you mint AI agents as inheritable, breedable on-chain entities. Two parent agents combine into a child whose personality, skills, tools, and memory are deterministically crossed over — with parents earning royalties on every descendant's earnings.

Built on [0G](https://0g.ai) for the 0G APAC Hackathon.

## Packages

| Package | Description |
|---------|-------------|
| [`packages/contracts`](./packages/contracts) | Smart contracts (AgentGenome INFT, Breeding, RoyaltySplitter, ReputationOracle, PredictionRound) |
| [`packages/sdk`](./packages/sdk) | TypeScript SDK — genome serialization, deterministic crossover, 0G Storage wrapper, typed contract clients |
| [`packages/runtime`](./packages/runtime) | Off-chain orchestrator — listens to chain events, computes child genomes, runs prediction rounds |
| [`packages/skills`](./packages/skills) | OpenClaw skill bundles for Progena agents |

## Status

Early development for the 0G APAC Hackathon (May 2026). On Galileo testnet today; mainnet deployment before submission.
