import { describe, it, expect } from "vitest";
import {
  buildCommitHash,
  generateNonce,
  MAX_PREDICTION,
  PredictionOutOfRangeError,
} from "./commit.js";

const NONCE_A = `0x${"01".repeat(32)}` as const;
const NONCE_B = `0x${"02".repeat(32)}` as const;

describe("buildCommitHash", () => {
  it("returns a 32-byte hex string", () => {
    const h = buildCommitHash(1n, 2n, 5000, NONCE_A);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic for identical inputs", () => {
    const a = buildCommitHash(1n, 2n, 5000, NONCE_A);
    const b = buildCommitHash(1n, 2n, 5000, NONCE_A);
    expect(a).toEqual(b);
  });

  it("differs when round id differs", () => {
    const a = buildCommitHash(1n, 2n, 5000, NONCE_A);
    const b = buildCommitHash(2n, 2n, 5000, NONCE_A);
    expect(a).not.toEqual(b);
  });

  it("differs when agent id differs", () => {
    const a = buildCommitHash(1n, 2n, 5000, NONCE_A);
    const b = buildCommitHash(1n, 3n, 5000, NONCE_A);
    expect(a).not.toEqual(b);
  });

  it("differs when prediction differs", () => {
    const a = buildCommitHash(1n, 2n, 5000, NONCE_A);
    const b = buildCommitHash(1n, 2n, 5001, NONCE_A);
    expect(a).not.toEqual(b);
  });

  it("differs when nonce differs", () => {
    const a = buildCommitHash(1n, 2n, 5000, NONCE_A);
    const b = buildCommitHash(1n, 2n, 5000, NONCE_B);
    expect(a).not.toEqual(b);
  });

  it("accepts the boundary predictions 0 and 10000", () => {
    expect(() => buildCommitHash(1n, 2n, 0, NONCE_A)).not.toThrow();
    expect(() => buildCommitHash(1n, 2n, MAX_PREDICTION, NONCE_A)).not.toThrow();
  });

  it("rejects predictions out of range", () => {
    expect(() => buildCommitHash(1n, 2n, -1, NONCE_A)).toThrow(PredictionOutOfRangeError);
    expect(() => buildCommitHash(1n, 2n, 10_001, NONCE_A)).toThrow(PredictionOutOfRangeError);
  });

  it("rejects non-integer predictions", () => {
    expect(() => buildCommitHash(1n, 2n, 5000.5, NONCE_A)).toThrow(PredictionOutOfRangeError);
  });
});

describe("generateNonce", () => {
  it("produces a 32-byte hex string", () => {
    const n = generateNonce();
    expect(n).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("returns different values across calls", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toEqual(b);
  });
});
