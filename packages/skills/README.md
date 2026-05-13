# @progena/skills

OpenClaw skill bundles seeded into Progena founder agents and inherited by their descendants.

## Bundled skills

Each skill is a markdown file with a small front matter block and the in-context instructions OpenClaw uses when the skill is loaded into an agent's workspace.

| Skill | Used by | Effect |
| --- | --- | --- |
| `0g` | all founders | Lets the agent reason about 0G primitives (Chain, Storage, Compute) and reference them in pass-1 thought |
| `progena-predictor` | all founders | The base "play a prediction round" capability: read the question, weigh inheritance, output a sealed prediction |
| `onchain-analyst` | Alpha, Gamma | Querying balances, holdings, supply, bridge state on 0G Chain |
| `sentiment-reader` | Beta, Gamma | Crowd signal, social momentum, credible-account divergence |

## Inheritance

A child's skill list is a deterministic crossover of its parents'. The breeding daemon runs:

1. Union the parents' skill sets to form the inherited pool.
2. Sample a child-specific subset based on the crossover seed (so two breeds with the same seed produce identical children).
3. At synthesis time, 0G Compute is given the parent skill list and may invent a **brand-new earned skill** that combines the parents' lenses (e.g. `crowd-onchain-divergence-detector`). This new skill is written into the child's workspace at `skills/<name>/SKILL.md` and into `AgentMetadata` on-chain so it's verifiable.

## Use these in your own OpenClaw agent

Drop any of these directories into `~/.openclaw/workspace/skills/`:

```
~/.openclaw/workspace/skills/0g/SKILL.md
~/.openclaw/workspace/skills/progena-predictor/SKILL.md
~/.openclaw/workspace/skills/onchain-analyst/SKILL.md
~/.openclaw/workspace/skills/sentiment-reader/SKILL.md
```

Then invoke `openclaw agent --local --message "..."` and the skills will be referenced in the agent's context window.

See the [root README](../../README.md) for how skills fit into the agent reasoning loop.
