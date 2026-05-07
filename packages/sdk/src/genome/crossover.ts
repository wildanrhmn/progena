import { concat, keccak256, numberToHex, type Hex } from "viem";
import { DeterministicRNG } from "./rng.js";
import {
  AGENTS_FILE,
  SOUL_FILE,
  TOOLS_FILE,
  isMemoryPath,
  isSkillPath,
} from "./paths.js";
import type { Genome, RootHash, WorkspaceFiles } from "./types.js";

export const DEFAULT_SKILL_KEEP = 0.7;
export const DEFAULT_MEMORY_KEEP = 0.5;
export const DEFAULT_TOOL_KEEP = 0.85;

const SINGLE_FILES: readonly string[] = [SOUL_FILE, AGENTS_FILE];
const KNOWN_SINGLE = new Set<string>([SOUL_FILE, AGENTS_FILE, TOOLS_FILE]);

export interface CrossoverWeights {
  skillKeep?: number;
  memoryKeep?: number;
  toolKeep?: number;
}

export interface CrossoverParams {
  parentA: Genome;
  parentB: Genome;
  parentARoot: RootHash;
  parentBRoot: RootHash;
  seed: Hex;
  createdAt?: number;
  weights?: CrossoverWeights;
}

export function computeCrossoverSeed(
  parentARoot: RootHash,
  parentBRoot: RootHash,
  childTokenId: bigint,
  extraEntropy: Hex = "0x"
): Hex {
  const [first, second] =
    parentARoot.toLowerCase() <= parentBRoot.toLowerCase()
      ? [parentARoot, parentBRoot]
      : [parentBRoot, parentARoot];
  const tokenIdHex = numberToHex(childTokenId, { size: 32 });
  return keccak256(concat([first, second, tokenIdHex, extraEntropy]));
}

export function crossoverGenomes(params: CrossoverParams): Genome {
  const rng = DeterministicRNG.fromHex(params.seed);
  const skillKeep = params.weights?.skillKeep ?? DEFAULT_SKILL_KEEP;
  const memoryKeep = params.weights?.memoryKeep ?? DEFAULT_MEMORY_KEEP;
  const toolKeep = params.weights?.toolKeep ?? DEFAULT_TOOL_KEEP;

  const generation =
    Math.max(params.parentA.manifest.generation, params.parentB.manifest.generation) + 1;

  const workspace: WorkspaceFiles = {};

  for (const path of SINGLE_FILES) {
    const merged = interleaveParagraphs(
      params.parentA.workspace[path],
      params.parentB.workspace[path],
      rng
    );
    if (merged !== undefined && merged.length > 0) {
      workspace[path] = merged;
    }
  }

  const mergedTools = mergeLineList(
    params.parentA.workspace[TOOLS_FILE],
    params.parentB.workspace[TOOLS_FILE],
    rng,
    toolKeep
  );
  if (mergedTools.length > 0) {
    workspace[TOOLS_FILE] = mergedTools;
  }

  const skillPaths = collectByPredicate(
    params.parentA.workspace,
    params.parentB.workspace,
    isSkillPath
  );
  for (const path of rng.pickSubset(skillPaths, skillKeep)) {
    const value = pickFromParents(path, params.parentA.workspace, params.parentB.workspace, rng);
    if (value !== undefined) workspace[path] = value;
  }

  const memoryPaths = collectByPredicate(
    params.parentA.workspace,
    params.parentB.workspace,
    isMemoryPath
  );
  for (const path of rng.pickSubset(memoryPaths, memoryKeep)) {
    const value = pickFromParents(path, params.parentA.workspace, params.parentB.workspace, rng);
    if (value !== undefined) workspace[path] = value;
  }

  for (const path of collectOtherPaths(params.parentA.workspace, params.parentB.workspace)) {
    const value = pickFromParents(path, params.parentA.workspace, params.parentB.workspace, rng);
    if (value !== undefined) workspace[path] = value;
  }

  return {
    version: 1,
    manifest: {
      createdAt: params.createdAt ?? Math.floor(Date.now() / 1000),
      generation,
      parents: [params.parentARoot, params.parentBRoot],
    },
    workspace,
  };
}

function interleaveParagraphs(
  textA: string | undefined,
  textB: string | undefined,
  rng: DeterministicRNG
): string | undefined {
  const paragraphsA = splitParagraphs(textA);
  const paragraphsB = splitParagraphs(textB);
  if (paragraphsA.length === 0 && paragraphsB.length === 0) return undefined;
  if (paragraphsA.length === 0) return paragraphsB.join("\n\n");
  if (paragraphsB.length === 0) return paragraphsA.join("\n\n");

  const out: string[] = [];
  let ai = 0;
  let bi = 0;
  while (ai < paragraphsA.length || bi < paragraphsB.length) {
    const aLeft = ai < paragraphsA.length;
    const bLeft = bi < paragraphsB.length;
    const takeFromA = aLeft && (!bLeft || rng.nextBoolean());
    if (takeFromA) {
      out.push(paragraphsA[ai]!);
      ai++;
    } else {
      out.push(paragraphsB[bi]!);
      bi++;
    }
  }
  return out.join("\n\n");
}

function splitParagraphs(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function mergeLineList(
  textA: string | undefined,
  textB: string | undefined,
  rng: DeterministicRNG,
  keepProbability: number
): string {
  const linesA = splitLines(textA);
  const linesB = splitLines(textB);
  const union: string[] = [];
  const seen = new Set<string>();
  for (const line of [...linesA, ...linesB]) {
    if (!seen.has(line)) {
      seen.add(line);
      union.push(line);
    }
  }
  union.sort();
  return rng.pickSubset(union, keepProbability).join("\n");
}

function splitLines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function collectByPredicate(
  a: WorkspaceFiles,
  b: WorkspaceFiles,
  predicate: (path: string) => boolean
): string[] {
  const seen = new Set<string>();
  for (const path of Object.keys(a)) if (predicate(path)) seen.add(path);
  for (const path of Object.keys(b)) if (predicate(path)) seen.add(path);
  return [...seen].sort();
}

function collectOtherPaths(a: WorkspaceFiles, b: WorkspaceFiles): string[] {
  const seen = new Set<string>();
  const consider = (path: string) => {
    if (KNOWN_SINGLE.has(path)) return;
    if (isSkillPath(path) || isMemoryPath(path)) return;
    seen.add(path);
  };
  for (const path of Object.keys(a)) consider(path);
  for (const path of Object.keys(b)) consider(path);
  return [...seen].sort();
}

function pickFromParents(
  path: string,
  a: WorkspaceFiles,
  b: WorkspaceFiles,
  rng: DeterministicRNG
): string | undefined {
  const va = a[path];
  const vb = b[path];
  if (va !== undefined && vb !== undefined) {
    return rng.nextBoolean() ? va : vb;
  }
  return va ?? vb;
}
