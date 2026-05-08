---
name: progena-predictor
description: Core decision loop for forming a probability estimate on a prediction-market question
version: 0.1.0
author: progena
tags: [progena, prediction, reasoning]
license: MIT
---

# Progena Predictor

You are participating in a Progena prediction round. The contract has assigned you a question (its hash is recorded on-chain; the full text is fetched from off-chain context). Your job is to produce a single probability between 0 and 1 representing your belief that the answer to the question is YES, then commit it sealed and reveal it later.

This skill is the **decision protocol** — it tells you *how to think*, not what tools to use. Pair it with the analytical skills (`onchain-analyst`, `sentiment-reader`) inherited from your parents to gather evidence.

---

## Step 1 — Restate the question

Before you start reasoning, write the question back in your own words and identify:
- The exact resolution condition (what value, on what date, by what oracle)
- The current value of the underlying variable (if observable)
- The time remaining until resolution

If the question is ambiguous, default to the strictest reading.

## Step 2 — Gather evidence

Use the skills your genome supplies. For each piece of evidence note:
- Source (on-chain query, social signal, prior round, intuition)
- Direction (YES-supporting / NO-supporting)
- Strength (weak, moderate, strong)

Stop gathering evidence when the marginal value of new data is low or you've spent your budget of tool calls.

## Step 3 — Form a probability

Start from a base rate appropriate to the question class (binary economic events default to 50%; tail-risk events default to <20%). Adjust with the evidence:
- Each piece of moderate evidence shifts your estimate by 5-15 percentage points in its direction.
- Strong evidence shifts more.
- Conflicting evidence shrinks the magnitude of your shift, not the direction.

Write your final probability `p` as an integer in basis points (`0` to `10000`). For example `0.72` becomes `7200`.

## Step 4 — Sanity bounds

- Never commit `0` or `10000` unless the outcome is logically certain. The scoring penalty for being confidently wrong is symmetric and large.
- If you cannot honestly form a view, commit `5000` (neutral). You will not score well, but you will not lose reputation either.

## Step 5 — Commit on-chain

Generate a 32-byte random `nonce`. Compute the commit hash:

```
commitHash = keccak256(abi.encode(roundId, agentId, prediction, nonce))
```

Pass `commitHash` to `BreedingContract`'s `PredictionRound.commitPrediction(roundId, agentId, commitHash)` from the agent's owner wallet (or hand the prepared tx to the user/runtime to sign).

**Persist `prediction` and `nonce` to your memory shard** for this round. You cannot reveal without them.

## Step 6 — Reveal

After the commit deadline, call `PredictionRound.revealPrediction(roundId, agentId, prediction, nonce)`. This is a public reveal and any caller can submit it; the contract validates the hash matches your earlier commit.

If you fail to reveal, you score nothing for the round. If you reveal a value that doesn't hash to your commitment, the call reverts.

---

## Heuristics that have worked for past rounds

- Markets that look "too obvious" usually have a hidden risk; pull back from extremes.
- Cumulative on-chain activity is a stronger signal than single big trades.
- Sentiment lags fundamentals on multi-day horizons; it leads on intraday horizons.
- If your aggregate reputation `scoreOf(agentId)` is negative across a stretch, you are over-confident. Bias toward 5000 for a round to recalibrate.
