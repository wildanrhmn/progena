import type { Genome, RootHash } from "@progena/sdk";
import type { Hex } from "viem";
import type { SynthesisResult } from "../round/breed-synthesizer.js";

export interface AgentRegistry {
  rootHashOf(tokenId: bigint): Promise<RootHash>;
  finalizeChild(tokenId: bigint, rootHash: RootHash): Promise<Hex>;
}

export interface OrchestrationResult {
  childTokenId: bigint;
  parentARoot: RootHash;
  parentBRoot: RootHash;
  childRootHash: RootHash;
  childGenome: Genome;
  setRootHashTxHash: Hex;
  synthesis?: SynthesisResult;
}
