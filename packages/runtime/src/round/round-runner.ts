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
import { agentNameForToken } from "../openclaw/register-agent.js";

export interface RoundRunnerOptions {
  chain: RoundChain;
  storage: GenomeStorage;
  inference: InferenceClient;
  agenticInference?: AgenticInferenceClient;
  useOpenClawAgent?: boolean;
  openclawBin?: string;
  commitStore: CommitStore;
  logger?: Logger;
  now?: () => number;
}

export interface PrepareCommitResult {
  agentId: bigint;
  prediction: number;
  commitHash: Hex;
  nonce: Hex;
  rawText: string;
  reasoningPreview: string;
  toolCalls?: ToolCallRecord[];
  inferenceModel?: string;
  inferenceIterations?: number;
  openclawReasoning?: string;
}

export interface CommitForAgentResult extends PrepareCommitResult {
  commitTxHash: Hex;
}

export interface RevealForAgentResult {
  agentId: bigint;
  prediction: number;
  revealTxHash: Hex;
}

export class RoundRunner {
  constructor(private readonly opts: RoundRunnerOptions) {}

  async prepareCommitForAgent(
    roundId: bigint,
    agentId: bigint,
    question: string
  ): Promise<PrepareCommitResult> {
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
    let openclawReasoning: string | undefined;

    const allowedTools = this.opts.agenticInference
      ? resolveToolList(context.toolList)
      : [];

    if (this.opts.useOpenClawAgent) {
      log?.info("OpenClaw pass 1: workspace-materialized reasoning", {
        skills: context.skillNames,
      });
      const openclawAgent = new OpenClawAgent({
        genome,
        openclawBin: this.opts.openclawBin,
        thinking: "minimal",
        logger: log,
        agentName: agentNameForToken(agentId),
      });
      try {
        const passOnePrompt = [
          `Question: ${question}`,
          ``,
          `Answer this question directly. State which way you lean (yes or no) and the 1-2 specific reasons that drive your answer.`,
          ``,
          `Rules:`,
          `- 2-3 sentences max.`,
          `- Do NOT describe yourself, your personality, your traits, or your SOUL. Just answer.`,
          `- Do NOT output a numeric prediction yet. Just the verbal lean and the why.`,
          `- Skip preamble. Start with the lean.`,
        ].join("\n");
        const result = await openclawAgent.ask(passOnePrompt);
        const reasoning = result.text.trim();
        if (reasoning.length > 0) {
          openclawReasoning = reasoning;
          log?.info("OpenClaw pass 1 captured", { chars: reasoning.length });
        } else {
          log?.warn("OpenClaw pass 1 returned empty");
        }
      } catch (err) {
        log?.warn("OpenClaw pass 1 failed, continuing without it", {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await openclawAgent.dispose();
      }
    }

    const augmentedSystemPrompt = openclawReasoning
      ? [
          context.systemPrompt,
          ``,
          `# Your prior reasoning from the OpenClaw agent runtime`,
          openclawReasoning,
          ``,
          `Use the prior reasoning above as your starting position. Verify or revise it using the tools available to you.`,
        ].join("\n")
      : context.systemPrompt;

    if (this.opts.agenticInference && allowedTools.length > 0) {
      log?.info("PASS 2: agentic inference with function-calling tools", {
        skills: context.skillNames,
        tools: allowedTools,
        usingOpenClawReasoning: !!openclawReasoning,
      });
      const agenticResult = await this.opts.agenticInference.run({
        systemPrompt: augmentedSystemPrompt,
        userPrompt,
        toolNames: allowedTools,
        temperature: 0.4,
        maxTokens: 900,
        maxIterations: 4,
        context: { logger: log, agentId, roundId },
      });
      rawText = agenticResult.finalText;
      prediction = extractPrediction(rawText);
      toolCalls = agenticResult.toolCalls;
      inferenceModel = openclawReasoning
        ? `openclaw-agent + ${agenticResult.model}`
        : agenticResult.model;
      inferenceIterations = agenticResult.iterations;
    } else {
      log?.info("PASS 2: single-prompt finalize", {
        skills: context.skillNames,
        usingOpenClawReasoning: !!openclawReasoning,
      });
      const { prediction: pred, raw } = await inferAndExtract(this.opts.inference, {
        systemPrompt: augmentedSystemPrompt,
        userPrompt,
      });
      prediction = pred;
      rawText = raw.text;
      inferenceModel = openclawReasoning
        ? `openclaw-agent + ${raw.model ?? "single-prompt"}`
        : raw.model;
    }

    const nonce = generateNonce();
    const commitHash = buildCommitHash(roundId, agentId, prediction, nonce);

    const reasoningPreview =
      rawText.length > 320 ? `${rawText.slice(0, 320)}…` : rawText;

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
      openclawReasoning,
    };
    await this.opts.commitStore.save(stored);

    log?.info("prepared commit", {
      prediction,
      commitHash,
      toolCallCount: toolCalls?.length ?? 0,
    });
    return {
      agentId,
      prediction,
      commitHash,
      nonce,
      rawText,
      reasoningPreview,
      toolCalls,
      openclawReasoning,
      inferenceModel,
      inferenceIterations,
    };
  }

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

    const prep = await this.prepareCommitForAgent(roundId, agentId, question);
    const entryFee = await this.opts.chain.entryFeeOf(roundId);

    log?.info("submitting commit", {
      prediction: prep.prediction,
      commitHash: prep.commitHash,
      entryFee: String(entryFee),
    });
    const commitTxHash = await this.opts.chain.commitPrediction(
      roundId,
      agentId,
      prep.commitHash,
      entryFee
    );
    const stored = await this.opts.commitStore.get(roundId, agentId);
    if (stored) {
      stored.commitTxHash = commitTxHash;
      await this.opts.commitStore.save(stored);
    }

    log?.info("committed", { commitTxHash });
    return { ...prep, commitTxHash };
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
