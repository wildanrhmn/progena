import { describe, it, expect } from "vitest";
import { DeterministicRNG } from "./rng.js";

const SEED_A = `0x${"11".repeat(32)}` as const;
const SEED_B = `0x${"22".repeat(32)}` as const;

describe("DeterministicRNG", () => {
  it("rejects seeds that are not 32 bytes", () => {
    expect(() => new DeterministicRNG(new Uint8Array(31))).toThrow(/32 bytes/);
    expect(() => new DeterministicRNG(new Uint8Array(33))).toThrow(/32 bytes/);
  });

  it("produces the same sequence for the same seed", () => {
    const rngA = DeterministicRNG.fromHex(SEED_A);
    const rngB = DeterministicRNG.fromHex(SEED_A);
    const seqA = Array.from({ length: 32 }, () => rngA.nextU32());
    const seqB = Array.from({ length: 32 }, () => rngB.nextU32());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const rngA = DeterministicRNG.fromHex(SEED_A);
    const rngB = DeterministicRNG.fromHex(SEED_B);
    const seqA = Array.from({ length: 16 }, () => rngA.nextU32());
    const seqB = Array.from({ length: 16 }, () => rngB.nextU32());
    expect(seqA).not.toEqual(seqB);
  });

  it("nextFloat lies in [0, 1)", () => {
    const rng = DeterministicRNG.fromHex(SEED_A);
    for (let i = 0; i < 200; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("nextBoolean(0) is always false and nextBoolean(1) is always true", () => {
    const rng = DeterministicRNG.fromHex(SEED_A);
    for (let i = 0; i < 50; i++) {
      expect(rng.nextBoolean(0)).toBe(false);
      expect(rng.nextBoolean(1)).toBe(true);
    }
  });

  it("nextBoundedInt stays in [0, max)", () => {
    const rng = DeterministicRNG.fromHex(SEED_A);
    for (let i = 0; i < 500; i++) {
      const v = rng.nextBoundedInt(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it("shuffle returns a permutation of the input", () => {
    const rng = DeterministicRNG.fromHex(SEED_A);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle(input);
    expect(shuffled).toHaveLength(input.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
  });

  it("shuffle is deterministic", () => {
    const a = DeterministicRNG.fromHex(SEED_A).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    const b = DeterministicRNG.fromHex(SEED_A).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a).toEqual(b);
  });

  it("pickSubset is deterministic and respects bounds", () => {
    const a = DeterministicRNG.fromHex(SEED_A).pickSubset([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5);
    const b = DeterministicRNG.fromHex(SEED_A).pickSubset([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5);
    expect(a).toEqual(b);
    expect(a.every((x) => x >= 1 && x <= 10)).toBe(true);
  });

  it("pickSubset throws on probability outside [0, 1]", () => {
    const rng = DeterministicRNG.fromHex(SEED_A);
    expect(() => rng.pickSubset([1, 2], -0.1)).toThrow();
    expect(() => rng.pickSubset([1, 2], 1.1)).toThrow();
  });
});
