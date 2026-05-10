import type { GenomeStorage } from "@progena/sdk";
import type { Hex } from "viem";
import type { Logger } from "../lib/logger.js";
import { toAgentContext, buildPredictionUserPrompt } from "./agent-context.js";
import { buildCommitHash, generateNonce } from "./commit.js";
import type { CommitStore, StoredCommitment } from "./commit-store.js";
import { inferAndExtract, type InferenceClient } from "./inference.js";
import type { RoundChain } from "./round-chain.js";

export interface RoundRunnerOptions {
  chain: RoundChain;
  storage: GenomeStorage;
  inference: InferenceClient;
  commitStore: CommitStore;
  logger?: Logger;
  now?: () => number;
}

export interface CommitForAgentResult {
  agentId: bigint;
  prediction: number;
  commitHash: Hex;
  commitTxHash: Hex;
  nonce: Hex;
  rawText: string;
}

export interface RevealForAgentResult {
  agentId: bigint;
  prediction: number;
  revealTxHash: Hex;
}

export class RoundRunner {
  constructor(private readonly opts: RoundRunnerOptions) {}

  async commitForAgent(
    roundId: bigint,
    agentId: bigint,
    question: string
  ): Promise<CommitForAgentResult> {
    const log = this.opts.logger?.child({
      component: "round-runner",
      roundId: String(roundId),
      agentId: String(agentId),
    });

    log?.info("loading agent genome");
    const rootHash = await this.opts.chain.rootHashOf(agentId);
    const genome = await this.opts.storage.downloadGenome(rootHash);

    const context = toAgentContext(genome);
    const userPrompt = buildPredictionUserPrompt(question);

    log?.info("running inference", { skills: context.skillNames });
    const { prediction, raw } = await inferAndExtract(this.opts.inference, {
      systemPrompt: context.systemPrompt,
      userPrompt,
    });

    const nonce = generateNonce();
    const commitHash = buildCommitHash(roundId, agentId, prediction, nonce);

    const entryFee = await this.opts.chain.entryFeeOf(roundId);
    log?.info("submitting commit", { prediction, commitHash, entryFee: String(entryFee) });
    const commitTxHash = await this.opts.chain.commitPrediction(
      roundId,
      agentId,
      commitHash,
      entryFee
    );

    const stored: StoredCommitment = {
      roundId: String(roundId),
      agentId: String(agentId),
      prediction,
      nonce,
      commitHash,
      committedAt: this.now(),
      commitTxHash,
      revealed: false,
    };
    await this.opts.commitStore.save(stored);

    log?.info("committed", { commitTxHash });
    return {
      agentId,
      prediction,
      commitHash,
      commitTxHash,
      nonce,
      rawText: raw.text,
    };
  }

  async revealForAgent(
    roundId: bigint,
    agentId: bigint
  ): Promise<RevealForAgentResult> {
    const log = this.opts.logger?.child({
      component: "round-runner",
      roundId: String(roundId),
      agentId: String(agentId),
    });

    const stored = await this.opts.commitStore.get(roundId, agentId);
    if (!stored) {
      throw new Error(`no stored commitment for round=${roundId} agent=${agentId}`);
    }
    if (stored.revealed) {
      throw new Error(`commitment for round=${roundId} agent=${agentId} already revealed`);
    }

    log?.info("submitting reveal", { prediction: stored.prediction });
    const revealTxHash = await this.opts.chain.revealPrediction(
      roundId,
      agentId,
      stored.prediction,
      stored.nonce
    );

    await this.opts.commitStore.markRevealed(roundId, agentId, revealTxHash);

    log?.info("revealed", { revealTxHash });
    return { agentId, prediction: stored.prediction, revealTxHash };
  }

  async commitForAgents(
    roundId: bigint,
    agentIds: bigint[],
    question: string
  ): Promise<CommitForAgentResult[]> {
    const out: CommitForAgentResult[] = [];
    for (const id of agentIds) {
      out.push(await this.commitForAgent(roundId, id, question));
    }
    return out;
  }

  async revealForAgents(
    roundId: bigint,
    agentIds: bigint[]
  ): Promise<RevealForAgentResult[]> {
    const out: RevealForAgentResult[] = [];
    for (const id of agentIds) {
      out.push(await this.revealForAgent(roundId, id));
    }
    return out;
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Math.floor(Date.now() / 1000);
  }
}
