import { encodeAbiParameters, keccak256, type Hex } from "viem";
import { randomBytes } from "node:crypto";

export const MIN_PREDICTION = 0;
export const MAX_PREDICTION = 10_000;

export class PredictionOutOfRangeError extends Error {
  constructor(public readonly prediction: number) {
    super(`prediction must be in [${MIN_PREDICTION}, ${MAX_PREDICTION}], got ${prediction}`);
    this.name = "PredictionOutOfRangeError";
  }
}

export function generateNonce(): Hex {
  const bytes = randomBytes(32);
  return ("0x" + bytes.toString("hex")) as Hex;
}

export function buildCommitHash(
  roundId: bigint,
  agentId: bigint,
  prediction: number,
  nonce: Hex
): Hex {
  if (
    !Number.isInteger(prediction) ||
    prediction < MIN_PREDICTION ||
    prediction > MAX_PREDICTION
  ) {
    throw new PredictionOutOfRangeError(prediction);
  }
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
