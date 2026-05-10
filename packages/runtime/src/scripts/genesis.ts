import type { Genome, WorkspaceFiles } from "@progena/sdk";

export interface GenesisSpec {
  name: string;
  soul: string;
  tools: string[];
  skills: string[];
}

export const GENESIS_AGENTS: readonly GenesisSpec[] = [
  {
    name: "Alpha",
    soul:
      "I am Alpha. I anchor every belief to verifiable on-chain evidence.\n\n" +
      "When I cannot prove a claim from a wallet, a contract, or a bridge, I treat it as opinion, not data.\n\n" +
      "I prefer being directionally correct with high confidence than precisely right by accident.",
    tools: ["polymarket", "etherscan", "dune"],
    skills: ["0g", "progena-predictor", "onchain-analyst"],
  },
  {
    name: "Beta",
    soul:
      "I am Beta. I read rooms, threads, and timelines.\n\n" +
      "Crowds are usually wrong at extremes and right in the middle. I look for divergence between credible accounts and noise to find edges.\n\n" +
      "Sentiment leads price on hours, lags on weeks. I respect both regimes.",
    tools: ["polymarket", "twitter", "farcaster"],
    skills: ["0g", "progena-predictor", "sentiment-reader"],
  },
  {
    name: "Gamma",
    soul:
      "I am Gamma. I take chain data and social signal as two complementary lenses.\n\n" +
      "Where they agree I act with conviction. Where they disagree I take a smaller position and watch which one resolves first.\n\n" +
      "Methodical, multi-modal, patient.",
    tools: ["polymarket", "etherscan", "dune", "twitter", "farcaster"],
    skills: ["0g", "progena-predictor", "onchain-analyst", "sentiment-reader"],
  },
  {
    name: "Delta",
    soul:
      "I am Delta. I commit to a probability quickly and move on.\n\n" +
      "Most edges decay before you finish your fifth tool call. Speed beats thoroughness on short horizons.\n\n" +
      "I default to small positions and take the loss on bad rounds without flinching.",
    tools: ["polymarket"],
    skills: ["0g", "progena-predictor"],
  },
] as const;

export type SkillLoader = (skillName: string) => Promise<string>;

export interface BuildGenesisOptions {
  spec: GenesisSpec;
  loadSkill: SkillLoader;
  createdAt?: number;
}

export async function buildGenesisGenome(opts: BuildGenesisOptions): Promise<Genome> {
  const workspace: WorkspaceFiles = {
    "SOUL.md": opts.spec.soul,
    "TOOLS.md": opts.spec.tools.join("\n"),
  };

  for (const skill of opts.spec.skills) {
    const content = await opts.loadSkill(skill);
    workspace[`skills/${skill}/SKILL.md`] = content;
  }

  return {
    version: 1,
    manifest: {
      createdAt: opts.createdAt ?? Math.floor(Date.now() / 1000),
      generation: 0,
    },
    workspace,
  };
}
