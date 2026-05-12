import {
  getContract,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  agentGenomeAbi,
  predictionRoundAbi,
  type GenomeStorage,
  type StorageBackend,
} from "@progena/sdk";
import type { Logger } from "../lib/logger.js";
import { RoundRunner } from "../round/round-runner.js";
import { createRoundChain } from "../round/round-chain.js";
import { createFileCommitStore, type CommitStore } from "../round/commit-store.js";
import type { InferenceClient } from "../round/inference.js";
import type { AgenticInferenceClient } from "../round/agentic-inference.js";
import {
  resolveRound,
  type ResolveRoundContext,
} from "../round/resolve-round.js";
import { memorizeRound } from "../round/memorize-round.js";
import { promoteSkills } from "../round/promote-skills.js";
import type { RoundCreatedEvent } from "../indexer/types.js";

const COMMIT_STAGGER_MS = 3_000;
const PHASE_BUFFER_MS = 8_000;
const POLL_RECOVER_INTERVAL_MS = 30_000;

export interface RoundOrchestratorOptions {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  chain: Chain;
  rpcUrl: string;
  storage: StorageBackend;
  genomeStorage: GenomeStorage;
  inference: InferenceClient;
  agenticInference: AgenticInferenceClient;
  resolveContext: ResolveRoundContext;
  commitStore: CommitStore;
  predictionRoundAddress: Address;
  agentGenomeAddress: Address;
  agentMemoryAddress: Address;
  agentMetadataAddress: Address;
  questionLookup: (roundId: bigint) => Promise<{ question: string; questionHash: Hex } | null>;
  useOpenClawAgent?: boolean;
  openclawBin?: string;
  logger?: Logger;
}

interface RoundJob {
  roundId: bigint;
  commitDeadline: number;
  revealDeadline: number;
  participants: bigint[];
  phase: RoundPhase;
  scheduledTimers: NodeJS.Timeout[];
  commitPhasePromise?: Promise<void>;
  revealPhasePromise?: Promise<void>;
}

type RoundPhase =
  | "pending"
  | "committing"
  | "awaiting-reveal"
  | "revealing"
  | "awaiting-resolve"
  | "resolving"
  | "memorizing"
  | "promoting"
  | "done"
  | "error";

export class RoundOrchestrator {
  private readonly opts: RoundOrchestratorOptions;
  private readonly jobs = new Map<string, RoundJob>();
  private readonly roundRunner: RoundRunner;
  private readonly genomeContract: ReturnType<typeof buildGenomeContract>;
  private readonly predictionContract: ReturnType<typeof buildPredictionContract>;
  private recoveryTimer?: NodeJS.Timeout;

  constructor(opts: RoundOrchestratorOptions) {
    this.opts = opts;
    this.roundRunner = new RoundRunner({
      chain: createRoundChain({
        agentGenomeAddress: opts.agentGenomeAddress,
        predictionRoundAddress: opts.predictionRoundAddress,
        publicClient: opts.publicClient,
        walletClient: opts.walletClient,
      }),
      storage: opts.genomeStorage,
      inference: opts.inference,
      agenticInference: opts.agenticInference,
      useOpenClawAgent: opts.useOpenClawAgent,
      openclawBin: opts.openclawBin,
      commitStore: opts.commitStore,
      logger: opts.logger?.child?.({ component: "round-runner-auto" }),
    });
    this.genomeContract = buildGenomeContract(opts.agentGenomeAddress, opts.publicClient);
    this.predictionContract = buildPredictionContract(
      opts.predictionRoundAddress,
      opts.publicClient
    );
  }

  async start(): Promise<void> {
    const log = this.opts.logger?.child?.({ component: "round-orchestrator" });
    log?.info?.("recovering unresolved rounds on boot");
    await this.recoverPendingRounds();

    this.recoveryTimer = setInterval(() => {
      this.recoverPendingRounds().catch((err) => {
        log?.warn?.("periodic recovery failed", { error: err instanceof Error ? err.message : String(err) });
      });
    }, POLL_RECOVER_INTERVAL_MS);
  }

  stop(): void {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    for (const job of this.jobs.values()) {
      for (const t of job.scheduledTimers) clearTimeout(t);
    }
    this.jobs.clear();
  }

  async onRoundCreated(event: RoundCreatedEvent): Promise<void> {
    await this.ingestRound(event.roundId, {
      commitDeadline: Number(event.commitDeadline),
      revealDeadline: Number(event.revealDeadline),
    });
  }

  private async recoverPendingRounds(): Promise<void> {
    const log = this.opts.logger?.child?.({ component: "round-orchestrator" });
    let nextId: bigint;
    try {
      nextId = (await this.predictionContract.read.nextRoundId()) as bigint;
    } catch (err) {
      log?.warn?.("could not read nextRoundId, skipping recovery", {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    for (let id = 1n; id < nextId; id++) {
      const key = String(id);
      if (this.jobs.has(key)) continue;
      try {
        const data = await this.predictionContract.read.roundOf([id]);
        if (data.resolved) {
          await this.handleResolvedRecovery(id, data);
          continue;
        }
        await this.ingestRound(id, {
          commitDeadline: Number(data.commitDeadline),
          revealDeadline: Number(data.revealDeadline),
        });
      } catch (err) {
        log?.warn?.("recover roundOf failed", {
          roundId: String(id),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async ingestRound(
    roundId: bigint,
    data: { commitDeadline: number; revealDeadline: number }
  ): Promise<void> {
    const log = this.opts.logger?.child?.({
      component: "round-orchestrator",
      roundId: String(roundId),
    });

    const key = String(roundId);
    if (this.jobs.has(key)) return;

    const job: RoundJob = {
      roundId,
      commitDeadline: data.commitDeadline,
      revealDeadline: data.revealDeadline,
      participants: [],
      phase: "pending",
      scheduledTimers: [],
    };
    this.jobs.set(key, job);

    const nowSec = Math.floor(Date.now() / 1000);

    if (nowSec <= job.commitDeadline) {
      log?.info?.("scheduling commit phase immediately");
      job.commitPhasePromise = this.runCommitPhase(job).catch((err) => {
        log?.error?.("commit phase failed", { error: err instanceof Error ? err.message : String(err) });
      });
      this.scheduleReveal(job);
      this.scheduleResolve(job);
    } else if (nowSec <= job.revealDeadline) {
      log?.info?.("commit phase already over, scheduling reveal-then-resolve");
      job.phase = "awaiting-reveal";
      this.scheduleReveal(job);
      this.scheduleResolve(job);
    } else {
      log?.info?.("reveal phase already over, going straight to resolve");
      job.phase = "awaiting-resolve";
      this.scheduleResolve(job);
    }
  }

  private scheduleReveal(job: RoundJob): void {
    const log = this.opts.logger?.child?.({
      component: "round-orchestrator",
      roundId: String(job.roundId),
    });
    const nowMs = Date.now();
    const fireAt = job.commitDeadline * 1000 + PHASE_BUFFER_MS;
    const delay = Math.max(0, fireAt - nowMs);
    log?.info?.("reveal scheduled", { in: `${Math.round(delay / 1000)}s` });
    const timer = setTimeout(async () => {
      if (job.commitPhasePromise) {
        await job.commitPhasePromise.catch(() => undefined);
      }
      job.revealPhasePromise = this.runRevealPhase(job).catch((err) => {
        log?.error?.("reveal phase failed", { error: err instanceof Error ? err.message : String(err) });
      });
    }, delay);
    job.scheduledTimers.push(timer);
  }

  private scheduleResolve(job: RoundJob): void {
    const log = this.opts.logger?.child?.({
      component: "round-orchestrator",
      roundId: String(job.roundId),
    });
    const nowMs = Date.now();
    const fireAt = job.revealDeadline * 1000 + PHASE_BUFFER_MS;
    const delay = Math.max(0, fireAt - nowMs);
    log?.info?.("resolve scheduled", { in: `${Math.round(delay / 1000)}s` });
    const timer = setTimeout(async () => {
      if (job.revealPhasePromise) {
        await job.revealPhasePromise.catch(() => undefined);
      }
      this.runResolvePhase(job).catch((err) => {
        log?.error?.("resolve phase failed", { error: err instanceof Error ? err.message : String(err) });
      });
    }, delay);
    job.scheduledTimers.push(timer);
  }

  private async runCommitPhase(job: RoundJob): Promise<void> {
    const log = this.opts.logger?.child?.({
      component: "round-orchestrator",
      roundId: String(job.roundId),
    });
    job.phase = "committing";

    let lookup = await this.opts.questionLookup(job.roundId);
    if (!lookup) {
      log?.info?.("no question text yet, polling RoundMetadata…");
      for (let attempt = 0; attempt < 12; attempt++) {
        await sleep(5_000);
        lookup = await this.opts.questionLookup(job.roundId);
        if (lookup) {
          log?.info?.("question text appeared", { afterMs: (attempt + 1) * 5000 });
          break;
        }
      }
    }
    if (!lookup) {
      log?.warn?.("no question text after 60s; skipping commits");
      job.phase = "awaiting-reveal";
      return;
    }

    const eligibleAgents = await this.discoverEligibleAgents();
    log?.info?.("commit phase starting", { eligible: eligibleAgents.length });

    const PER_COMMIT_BUDGET_S = 45;

    for (const agentId of eligibleAgents) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec + PER_COMMIT_BUDGET_S > job.commitDeadline) {
        log?.warn?.("commit deadline too close, stopping commit phase", {
          remainingS: job.commitDeadline - nowSec,
          skippedAgents: eligibleAgents.length - job.participants.length,
        });
        break;
      }
      try {
        const existing = await this.predictionContract.read.commitmentOf([job.roundId, agentId]);
        if (existing.exists) {
          log?.info?.("skipping (already committed)", { agentId: String(agentId) });
          job.participants.push(agentId);
          continue;
        }
        log?.info?.("committing for agent", { agentId: String(agentId) });
        await this.roundRunner.commitForAgent(job.roundId, agentId, lookup.question);
        job.participants.push(agentId);
      } catch (err) {
        log?.warn?.("commit failed for agent (continuing)", {
          agentId: String(agentId),
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await sleep(COMMIT_STAGGER_MS);
    }

    log?.info?.("commit phase complete", { committed: job.participants.length });
    job.phase = "awaiting-reveal";
  }

  private async runRevealPhase(job: RoundJob): Promise<void> {
    const log = this.opts.logger?.child?.({
      component: "round-orchestrator",
      roundId: String(job.roundId),
    });
    job.phase = "revealing";

    if (job.participants.length === 0) {
      const persisted = await this.opts.commitStore.listForRound(job.roundId);
      job.participants = persisted.map((c) => BigInt(c.agentId));
      log?.info?.("reconstructed participants from commit-store", {
        count: job.participants.length,
      });
    }

    for (const agentId of job.participants) {
      try {
        const existing = await this.predictionContract.read.commitmentOf([job.roundId, agentId]);
        if (!existing.exists) {
          log?.info?.("skipping reveal (no on-chain commit)", { agentId: String(agentId) });
          continue;
        }
        if (existing.revealed) {
          log?.info?.("skipping reveal (already revealed)", { agentId: String(agentId) });
          continue;
        }
        log?.info?.("revealing for agent", { agentId: String(agentId) });
        await this.roundRunner.revealForAgent(job.roundId, agentId);
      } catch (err) {
        log?.warn?.("reveal failed for agent (continuing)", {
          agentId: String(agentId),
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await sleep(1_500);
    }

    log?.info?.("reveal phase complete");
    job.phase = "awaiting-resolve";
  }

  private async runResolvePhase(job: RoundJob): Promise<void> {
    const log = this.opts.logger?.child?.({
      component: "round-orchestrator",
      roundId: String(job.roundId),
    });
    job.phase = "resolving";

    const lookup = await this.opts.questionLookup(job.roundId);
    if (!lookup) {
      log?.warn?.("no question text for resolve; cannot run oracle");
      job.phase = "error";
      return;
    }

    let outcome: number | undefined;
    try {
      const data = await this.predictionContract.read.roundOf([job.roundId]);
      if (data.resolved) {
        log?.info?.("already resolved on-chain", { outcome: data.outcome });
        outcome = data.outcome;
      } else {
        log?.info?.("running research oracle");
        const r = await resolveRound(
          {
            roundId: job.roundId,
            question: lookup.question,
            questionHash: lookup.questionHash,
          },
          this.opts.resolveContext
        );
        outcome = r.outcome;
        log?.info?.("oracle resolved", { outcome, toolCalls: r.toolCalls.length });
      }
    } catch (err) {
      log?.error?.("oracle failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      job.phase = "error";
      return;
    }

    job.phase = "memorizing";
    try {
      const persisted = await this.opts.commitStore.listForRound(job.roundId);
      const ids = persisted.map((c) => BigInt(c.agentId));
      const memResult = await memorizeRound(
        {
          roundId: job.roundId,
          question: lookup.question,
          questionHash: lookup.questionHash,
          agentIds: ids,
        },
        {
          publicClient: this.opts.publicClient,
          walletClient: this.opts.walletClient,
          account: this.opts.account,
          chain: this.opts.chain,
          storage: this.opts.storage,
          inference: this.opts.inference,
          commitStore: this.opts.commitStore,
          predictionRoundAddress: this.opts.predictionRoundAddress,
          agentMemoryAddress: this.opts.agentMemoryAddress,
          logger: log,
        }
      );
      log?.info?.("memorize complete", {
        shards: memResult.shards.length,
        skipped: memResult.skipped.length,
        failed: memResult.failed.length,
      });

      job.phase = "promoting";
      const promoteResult = await promoteSkills(
        { agentIds: ids, earnedInRound: job.roundId, lookback: 5 },
        {
          publicClient: this.opts.publicClient,
          walletClient: this.opts.walletClient,
          account: this.opts.account,
          chain: this.opts.chain,
          storage: this.opts.storage,
          inference: this.opts.inference,
          agentMemoryAddress: this.opts.agentMemoryAddress,
          agentMetadataAddress: this.opts.agentMetadataAddress,
          logger: log,
        }
      );
      log?.info?.("skill-promote complete", {
        promoted: promoteResult.promoted.length,
        declined: promoteResult.declined.length,
      });
      for (const p of promoteResult.promoted) {
        log?.info?.("agent earned skill", {
          agentId: String(p.agentId),
          skill: p.skillName,
          rootHash: p.rootHash,
          tx: p.txHash,
        });
      }
    } catch (err) {
      log?.error?.("post-resolve pipeline failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      job.phase = "error";
      return;
    }

    job.phase = "done";
    log?.info?.("round complete (autonomous)", { outcome });
  }

  private async handleResolvedRecovery(
    roundId: bigint,
    data: { outcome: number }
  ): Promise<void> {
    const log = this.opts.logger?.child?.({
      component: "round-orchestrator",
      roundId: String(roundId),
    });

    const persisted = await this.opts.commitStore.listForRound(roundId);
    const ids = persisted.map((c) => BigInt(c.agentId));
    if (ids.length === 0) return;

    try {
      const sample = ids[0]!;
      const total = (await this.opts.publicClient.readContract({
        address: this.opts.agentMemoryAddress,
        abi: [
          {
            type: "function",
            name: "shardCountOf",
            stateMutability: "view",
            inputs: [{ type: "uint256" }],
            outputs: [{ type: "uint256" }],
          },
        ] as const,
        functionName: "shardCountOf",
        args: [sample],
      })) as bigint;
      if (total > 0n) return;
    } catch {
      /* */
    }

    const lookup = await this.opts.questionLookup(roundId);
    if (!lookup) return;

    log?.info?.("recovering memorize+promote for resolved round");

    const job: RoundJob = {
      roundId,
      commitDeadline: 0,
      revealDeadline: 0,
      participants: ids,
      phase: "memorizing",
      scheduledTimers: [],
    };
    this.jobs.set(String(roundId), job);

    try {
      await memorizeRound(
        {
          roundId,
          question: lookup.question,
          questionHash: lookup.questionHash,
          agentIds: ids,
        },
        {
          publicClient: this.opts.publicClient,
          walletClient: this.opts.walletClient,
          account: this.opts.account,
          chain: this.opts.chain,
          storage: this.opts.storage,
          inference: this.opts.inference,
          commitStore: this.opts.commitStore,
          predictionRoundAddress: this.opts.predictionRoundAddress,
          agentMemoryAddress: this.opts.agentMemoryAddress,
          logger: log,
        }
      );
      await promoteSkills(
        { agentIds: ids, earnedInRound: roundId, lookback: 5 },
        {
          publicClient: this.opts.publicClient,
          walletClient: this.opts.walletClient,
          account: this.opts.account,
          chain: this.opts.chain,
          storage: this.opts.storage,
          inference: this.opts.inference,
          agentMemoryAddress: this.opts.agentMemoryAddress,
          agentMetadataAddress: this.opts.agentMetadataAddress,
          logger: log,
        }
      );
      job.phase = "done";
    } catch (err) {
      log?.warn?.("recovery failed (will retry on next pass)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async discoverEligibleAgents(): Promise<bigint[]> {
    const totalMinted = (await this.genomeContract.read.totalMinted()) as bigint;
    const eligible: bigint[] = [];
    for (let id = 1n; id <= totalMinted; id++) {
      try {
        const owner = (await this.genomeContract.read.ownerOf([id])) as Address;
        if (owner.toLowerCase() !== this.opts.account.address.toLowerCase()) continue;
        const finalized = (await this.genomeContract.read.isFinalized([id])) as boolean;
        if (!finalized) continue;
        eligible.push(id);
      } catch {
        /* */
      }
    }
    return eligible;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGenomeContract(address: Address, publicClient: PublicClient) {
  return getContract({
    address,
    abi: agentGenomeAbi,
    client: { public: publicClient },
  });
}

function buildPredictionContract(address: Address, publicClient: PublicClient) {
  return getContract({
    address,
    abi: predictionRoundAbi,
    client: { public: publicClient },
  });
}
