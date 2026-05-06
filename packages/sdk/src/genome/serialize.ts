import { keccak256 } from "viem";
import { type Genome, validateGenome } from "./types.js";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  const body = entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",");
  return `{${body}}`;
}

export function serializeGenome(genome: Genome): Uint8Array {
  const validated = validateGenome(genome);
  return new TextEncoder().encode(stableStringify(validated));
}

export function deserializeGenome(bytes: Uint8Array): Genome {
  const text = new TextDecoder().decode(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new Error("genome bytes are not valid JSON", { cause });
  }
  return validateGenome(parsed);
}

export function hashGenome(genome: Genome): `0x${string}` {
  return keccak256(serializeGenome(genome));
}
