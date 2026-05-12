import type { GenomeStorage } from "@progena/sdk";
import type { Hex } from "viem";
import type { Logger } from "../lib/logger.js";
import { toAgentContext, buildPredictionUserPrompt } from "./agent-context.js";
import { buildCommitHash, generateNonce } from "./commit.js";
import type { CommitStore, StoredCommitment } from "./commit-store.js";
import { inferAndExtract, type InferenceClient } from "./inference.js";
import { extractPrediction } from "./prediction.js";
import type { AgenticInferenceClient } from "./agentic-inference.js";
import { resolveToolList } from "../tools/alias.js";
import type { ToolCallRecord } from "../tools/types.js";
import type { RoundChain } from "./round-chain.js";
import { OpenClawAgent } from "../openclaw/openclaw-agent.js";

export interface RoundRunnerOptions {
  chain: RoundChain;
  storage: GenomeStorage;
  inference: InferenceClient;
  agenticInference?: AgenticInferenceClient;
  /**
   * If true, route commits through OpenClawAgent (workspace-materialized
   * agent mode) when the agent has no resolvable tools. When the agent has
   * tools, we still use the function-calling path so tools actually execute.
   */
  useOpenClawAgent?: boolean;
  openclawBin?: string;
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
  toolCalls?: ToolCallRecord[];
  inferenceModel?: string;
  inferenceIterations?: number;
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

    let prediction: number;
    let rawText: string;
    let toolCalls: ToolCallRecord[] | undefined;
    let inferenceModel: string | undefined;
    let inferenceIterations: number | undefined;

    const allowedTools = this.opts.agenticInference
      ? resolveToolList(context.toolList)
      : [];

    if (this.opts.agenticInference && allowedTools.length > 0) {
      log?.info("running agentic inference (function-calling tools)", {
        skills: context.skillNames,
        tools: allowedTools,
      });
      const agenticResult = await this.opts.agenticInference.run({
        systemPrompt: context.systemPrompt,
        userPrompt,
        toolNames: allowedTools,
        temperature: 0.4,
        maxTokens: 1200,
        maxIterations: 6,
        context: { logger: log, agentId, roundId },
      });
      rawText = agenticResult.finalText;
      prediction = extractPrediction(rawText);
      toolCalls = agenticResult.toolCalls;
      inferenceModel = agenticResult.model;
      inferenceIterations = agenticResult.iterations;
    } else if (this.opts.useOpenClawAgent) {
      // Real OpenClaw orchestration: materialize the genome workspace +
      // spawn `openclaw agent --message <q>`. The OpenClaw runtime loads
      // SOUL.md as personality and exposes skills/* via its workspace.
      log?.info("running OpenClaw agent (workspace-materialized)", {
        skills: context.skillNames,
      });
      const openclawAgent = new OpenClawAgent({
        genome,
        openclawBin: this.opts.openclawBin,
        thinking: "high",
        logger: log,
      });
      try {
        const result = await openclawAgent.ask(`${userPrompt}\n\n(Round ${roundId} as OpenClaw agent #${agentId})`);
        rawText = result.text;
        prediction = extractPrediction(rawText);
        inferenceModel = "openclaw/agent-mode";
      } finally {
        await openclawAgent.dispose();
      }
    } else {
      log?.info("running single-prompt inference (no tools available)", {
        skills: context.skillNames,
      });
      const { prediction: pred, raw } = await inferAndExtract(this.opts.inference, {
        systemPrompt: context.systemPrompt,
        userPrompt,
      });
      prediction = pred;
      rawText = raw.text;
      inferenceModel = raw.model;
    }

    const nonce = generateNonce();
    const commitHash = buildCommitHash(roundId, agentId, prediction, nonce);

    const entryFee = await this.opts.chain.entryFeeOf(roundId);
    const reasoningPreview =
      rawText.length > 320 ? `${rawText.slice(0, 320)}…` : rawText;

    // Persist nonce + commit hash FIRST so we can always reveal even if the
    // tx submission or receipt-poll crashes downstream.
    const stored: StoredCommitment = {
      roundId: String(roundId),
      agentId: String(agentId),
      prediction,
      nonce,
      commitHash,
      committedAt: this.now(),
      revealed: false,
      inferenceModel,
      inferenceIterations,
      toolCalls,
      reasoningPreview,
    };
    await this.opts.commitStore.save(stored);

    log?.info("submitting commit", {
      prediction,
      commitHash,
      entryFee: String(entryFee),
      toolCallCount: toolCalls?.length ?? 0,
    });
    const commitTxHash = await this.opts.chain.commitPrediction(
      roundId,
      agentId,
      commitHash,
      entryFee
    );
    stored.commitTxHash = commitTxHash;
    await this.opts.commitStore.save(stored);

    log?.info("committed", { commitTxHash });
    return {
      agentId,
      prediction,
      commitHash,
      commitTxHash,
      nonce,
      rawText,
      toolCalls,
      inferenceModel,
      inferenceIterations,
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
