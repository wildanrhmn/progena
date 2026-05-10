import {
  computeCrossoverSeed,
  crossoverGenomes,
  type GenomeStorage,
} from "@progena/sdk";
import type { Logger } from "../lib/logger.js";
import type { BreedingEvent } from "../indexer/types.js";
import type { AgentRegistry, OrchestrationResult } from "./types.js";

export interface CrossoverOrchestratorOptions {
  registry: AgentRegistry;
  storage: GenomeStorage;
  logger?: Logger;
  computeCreatedAt?: (event: BreedingEvent) => number | Promise<number>;
}

export class CrossoverOrchestrator {
  constructor(private readonly opts: CrossoverOrchestratorOptions) {}

  async handleBreeding(event: BreedingEvent): Promise<OrchestrationResult> {
    const log = this.opts.logger?.child({
      component: "crossover-orchestrator",
      childTokenId: String(event.childTokenId),
    });

    log?.info("starting crossover", {
      parentA: String(event.parentA),
      parentB: String(event.parentB),
    });

    const [parentARoot, parentBRoot] = await Promise.all([
      this.opts.registry.rootHashOf(event.parentA),
      this.opts.registry.rootHashOf(event.parentB),
    ]);

    log?.debug("parent roots fetched", { parentARoot, parentBRoot });

    const [parentAGenome, parentBGenome] = await Promise.all([
      this.opts.storage.downloadGenome(parentARoot),
      this.opts.storage.downloadGenome(parentBRoot),
    ]);

    log?.debug("parent genomes downloaded");

    const seed = computeCrossoverSeed(parentARoot, parentBRoot, event.childTokenId);
    const createdAt = this.opts.computeCreatedAt
      ? await this.opts.computeCreatedAt(event)
      : Math.floor(Date.now() / 1000);

    const childGenome = crossoverGenomes({
      parentA: parentAGenome,
      parentB: parentBGenome,
      parentARoot,
      parentBRoot,
      seed,
      createdAt,
    });

    log?.debug("child genome computed", {
      generation: childGenome.manifest.generation,
      workspaceFiles: Object.keys(childGenome.workspace).length,
    });

    const upload = await this.opts.storage.uploadGenome(childGenome);
    log?.info("child genome uploaded", { childRootHash: upload.rootHash });

    const setRootHashTxHash = await this.opts.registry.finalizeChild(
      event.childTokenId,
      upload.rootHash
    );

    log?.info("child finalized on-chain", {
      childRootHash: upload.rootHash,
      txHash: setRootHashTxHash,
    });

    return {
      childTokenId: event.childTokenId,
      parentARoot,
      parentBRoot,
      childRootHash: upload.rootHash,
      childGenome,
      setRootHashTxHash,
    };
  }
}
