import { encodeAbiParameters, keccak256, toHex } from "viem";

const STORAGE_PREFIX = "progena:commit:";

export type SavedCommit = {
  prediction: number;
  nonce: `0x${string}`;
  commitHash: `0x${string}`;
  savedAt: number;
};

export function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function buildCommitHash(
  roundId: bigint,
  agentId: bigint,
  prediction: number,
  nonce: `0x${string}`
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint16" },
        { type: "bytes32" },
      ],
      [roundId, agentId, prediction, nonce]
    )
  );
}

function keyOf(roundId: bigint, agentId: bigint): string {
  return `${STORAGE_PREFIX}${roundId.toString()}:${agentId.toString()}`;
}

export function saveCommit(roundId: bigint, agentId: bigint, c: SavedCommit) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(keyOf(roundId, agentId), JSON.stringify(c));
}

export function loadCommit(
  roundId: bigint,
  agentId: bigint
): SavedCommit | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(keyOf(roundId, agentId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as SavedCommit;
  } catch {
    return undefined;
  }
}

export function clearCommit(roundId: bigint, agentId: bigint) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(keyOf(roundId, agentId));
}
