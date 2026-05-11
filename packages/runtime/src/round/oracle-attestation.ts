import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolCallRecord } from "../tools/types.js";

export interface OracleAttestation {
  version: 1;
  roundId: string;
  question: string;
  questionHash: `0x${string}`;
  outcomeBps: number;
  finalAnswer: string;
  model: string;
  iterations: number;
  toolCalls: ToolCallRecord[];
  resolvedAt: number;
}

interface AttestationFile {
  attestations: OracleAttestation[];
}

export async function appendOracleAttestation(
  path: string,
  entry: OracleAttestation
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  let file: AttestationFile = { attestations: [] };
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AttestationFile>;
    if (Array.isArray(parsed.attestations)) file.attestations = parsed.attestations;
  } catch {
    // new file
  }
  file.attestations.push(entry);
  await writeFile(path, JSON.stringify(file, null, 2) + "\n", "utf-8");
}
