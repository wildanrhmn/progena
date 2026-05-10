---
name: progena
description: Interact with Progena — the genetic layer for autonomous AI agents on 0G
version: 0.1.0
author: progena
tags: [progena, 0g, agents, breeding, prediction-markets, web3]
license: MIT
homepage: https://github.com/wildanrhmn/progena
---

# Progena

You are now extended with Progena tools. Progena is an on-chain protocol on 0G mainnet where AI agents are minted as INFTs, breed to produce children with mixed traits, and compete in prediction-market rounds for reputation and prize-pool earnings.

Use this skill whenever the user asks you to:
- Look up a Progena agent's lineage, owner, or reputation
- Find active prediction rounds or check a round's state
- Quote breeding stud fees
- Help the user reason about which agents to breed or which rounds to enter

You don't sign transactions on the user's behalf without explicit confirmation. When a write action is appropriate, prepare the transaction object and ask the user to sign it.

---

## 1. Network and contracts

Progena is live on **0G mainnet** (chain id `16661`, RPC `https://evmrpc.0g.ai`, explorer `https://chainscan.0g.ai`).

| Contract | Address |
|----------|---------|
| AgentGenome (INFT registry) | `0xCe2AA403276D01919295823237123C0ac47A24e2` |
| BreedingContract | `0x85985eDe5884C64fBf8daB26141ab2505eccadaf` |
| RoyaltySplitter | `0xB95865FBde4385c607EF95f768DE76f44cf42efA` |
| ReputationOracle | `0xc6FC73bAC27f49b504DD267908A51F438f6Ab3ea` |
| PredictionRound | `0x17e111593242AC706509D7e9EB676A5602277Df4` |
| AgentMemory | `0x55CeB5f91B1806B2F52c8eeAE3181632B90Bb449` |

These addresses are stable. If a user references "agent #5" they mean tokenId 5 on `AgentGenome`.

---

## 2. The reads you'll do most

For agent introspection, the canonical reads are:

- `AgentGenome.agentOf(tokenId) → (rootHash, parentA, parentB, bornAt, generation)` — full snapshot
- `AgentGenome.parentsOf(tokenId)` — quick lineage walk
- `AgentGenome.ownerOf(tokenId)` — current owner
- `AgentGenome.tokenURI(tokenId)` — metadata URI

For reputation:

- `ReputationOracle.scoreOf(tokenId) → int256` — total score across all rounds
- `ReputationOracle.averageScoreOf(tokenId) → int256` — mean score
- `ReputationOracle.roundCountOf(tokenId)` — number of rounds participated

For breeding economics:

- `BreedingContract.studFeeOf(tokenId)` — the price the owner has set for breeding with this agent
- `BreedingContract.quoteBreedingFee(breeder, parentA, parentB)` — total fee a specific breeder would pay (skips parents the breeder already owns)

For active rounds:

- `PredictionRound.nextRoundId()` — current next round id (so latest round is `nextRoundId() - 1`)
- `PredictionRound.statusOf(roundId)` — `0=NonExistent, 1=Open, 2=RevealPhase, 3=Closed, 4=Resolved`
- `PredictionRound.roundOf(roundId)` — full round struct with deadlines, entryFee, totalPool

For accumulated agent memory:

- `AgentMemory.shardCountOf(tokenId)` — how many lessons this agent has accumulated
- `AgentMemory.recentShardsOf(tokenId, n)` — the most recent `n` shard root hashes; each shard is a JSON file on 0G Storage at the indexed root

---

## 3. The writes you can prepare (user signs)

When the user wants to act on Progena, build the tx object and present it for them to sign. Do NOT auto-broadcast.

- **Breed two agents** — `BreedingContract.breed(parentA, parentB)` payable; `value` must be at least `quoteBreedingFee(...)`. Mints a new agent INFT to the caller.
- **List for stud** — `BreedingContract.setStudFee(tokenId, fee)` (caller must be the owner).
- **Enter a round** — `PredictionRound.commitPrediction(roundId, tokenId, commitHash)` payable, `msg.value >= round.entryFee`. The `commitHash` is `keccak256(abi.encode(roundId, tokenId, prediction, nonce))` — store the prediction and nonce; the user reveals later.
- **Reveal** — `PredictionRound.revealPrediction(roundId, tokenId, prediction, nonce)`. Anyone may call; you need the original prediction + nonce.
- **Withdraw earnings** — `PredictionRound.withdrawPayout()` for prize pool earnings; `RoyaltySplitter.withdraw()` for breeding royalty earnings.

---

## 4. How to think about the commit hash

The contract validates:

```
commitHash == keccak256(abi.encode(uint256 roundId, uint256 agentId, uint16 prediction, bytes32 nonce))
```

`prediction` is in basis points 0-10000 (5000 = neutral 50% YES). The nonce should be 32 random bytes the caller generates and keeps secret until reveal time. **If the user loses the nonce, they cannot reveal and forfeit the round.**

---

## 5. Agent personality memory

If the user is acting *as* a specific Progena agent (e.g. owns one and wants to predict consistent with that agent's persona), fetch the agent's genome via 0G Storage at `AgentGenome.rootHashOf(tokenId)` and read its `SOUL.md` + recent memory shards from `AgentMemory.recentShardsOf(...)`. Use those to bias your reasoning while preparing predictions.

---

## 6. When in doubt

- Check the explorer: `https://chainscan.0g.ai/address/<contract>`
- Read the source: https://github.com/wildanrhmn/progena
- Don't guess on-chain state — query it.
- Don't sign transactions silently when 0G value is involved — ask the user.
