# @progena/contracts

Smart contracts for [Progena](https://github.com/wildanrhmn/progena). All 9 are live on **0G mainnet** (chain id `16661`).

## Contracts

| Contract | Address | Role |
| --- | --- | --- |
| `AgentGenome` | [`0xCe2AA403…`](https://chainscan.0g.ai/address/0xCe2AA403276D01919295823237123C0ac47A24e2) | ERC-721 INFT. Holds each agent's `rootHash` pointing at its genome on 0G Storage |
| `BreedingContract` | [`0x85985eDe…`](https://chainscan.0g.ai/address/0x85985eDe5884C64fBf8daB26141ab2505eccadaf) | `requestBreed` entry point; emits the event the daemon catches |
| `RoyaltySplitter` | [`0xB95865FB…`](https://chainscan.0g.ai/address/0xB95865FBde4385c607EF95f768DE76f44cf42efA) | Walks the ancestor tree and distributes breeding fees up the lineage |
| `ReputationOracle` | [`0xc6FC73bA…`](https://chainscan.0g.ai/address/0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea) | Posts Brier-style round scores; `PredictionRound` is the only reporter |
| `PredictionRound` | [`0x17e11159…`](https://chainscan.0g.ai/address/0x17e111593242AC706509D7e9EB676A5602277Df4) | Commit-reveal market with entry-fee + sponsor prize pool |
| `AgentMemory` | [`0x55CeB5f9…`](https://chainscan.0g.ai/address/0x55CeB5f91B1806B2F52c8eeAE3181632B90Bb449) | Per-agent memory-shard hashes pointing at 0G Storage |
| `AgentMetadata` (UUPS proxy) | [`0xfc3590a3…`](https://chainscan.0g.ai/address/0xfc3590a397f8fc0e729a5bcfe6a1040da20e432b) | Names, traits, earned skills (upgradeable) |
| `RoundMetadata` (UUPS proxy) | [`0x884b9c79…`](https://chainscan.0g.ai/address/0x884b9c792ec6423e3005c689e47a3f24247d3c5a) | Question text per round (upgradeable) |
| `AgentRegistry` | [`0x4560a71a…`](https://chainscan.0g.ai/address/0x4560a71a07cf8172cfb0bf61b96a5480255cec8d) | Claim-once unique agent names |

All addresses also live in [`deployments/mainnet.json`](./deployments/mainnet.json).

## Stack

Solidity 0.8.28, Hardhat, OpenZeppelin (UUPS upgradeable for `AgentMetadata` and `RoundMetadata`).

## Develop

```bash
npm install
npm run build         # compile
npm run test          # full Hardhat test suite
npm run coverage      # solidity-coverage
```

## Deploy

Deployments are scripted under [`scripts/`](./scripts) and write to `deployments/<network>.json`. Galileo testnet and mainnet are both supported.

```bash
# testnet
npx hardhat run scripts/deploy.ts --network galileo

# mainnet (review params first!)
npx hardhat run scripts/deploy.ts --network mainnet
```

Wirings (set after deploy):

- `AgentGenome.setBreedingContract(BreedingContract)`
- `AgentGenome.setGenomeWriter(daemon-wallet)`
- `ReputationOracle.setReporter(PredictionRound)`
- `AgentMemory.setMemoryWriter(daemon-wallet)`

See the [root README](../../README.md) for the full architecture and Track 1 fit.
