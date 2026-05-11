import { describe, it, expect } from "vitest";
import { parseOracleOutcome, clampOutcome } from "./oracle-parser.js";

describe("parseOracleOutcome", () => {
  it("captures FINAL_ANSWER: <int> as the authoritative answer", () => {
    expect(parseOracleOutcome("Some reasoning.\n\nFINAL_ANSWER: 0")).toBe(0);
    expect(parseOracleOutcome("FINAL_ANSWER: 8500")).toBe(8500);
    expect(parseOracleOutcome("FINAL_ANSWER:10000")).toBe(10_000);
  });

  it("is not fooled by dollar amounts and dates in reasoning", () => {
    const text = `
Looking at the evidence, Bitcoin's current spot price is well below $100,000 -
around $81,000-$82,000 range. There is no evidence suggesting the current
price is above $100,000.

FINAL_ANSWER: 0`;
    expect(parseOracleOutcome(text)).toBe(0);
  });

  it("prefers the LAST FINAL_ANSWER occurrence (in case model repeats)", () => {
    const text = "FINAL_ANSWER: 5000\n\nWait, on second thought.\n\nFINAL_ANSWER: 1500";
    expect(parseOracleOutcome(text)).toBe(1500);
  });

  it("falls back to 'answer: <int>' form", () => {
    expect(parseOracleOutcome("My answer: 7200")).toBe(7200);
    expect(parseOracleOutcome("outcome = 1234")).toBe(1234);
  });

  it("clamps values > 10000 to 10000 in loose match", () => {
    // 12345 > 10_000 so it fails the labelled match validator; falls through
    // to numeric scan of the last 3 lines.
    expect(parseOracleOutcome("answer: 12345\n9500")).toBe(9500);
  });

  it("uses last 3 lines for the numeric fallback", () => {
    const text = `
Long reasoning... $50,000 was the price in 2020.
Many references to large numbers, $100,000, $200,000, etc.
...

Conclusion line.
2500`;
    expect(parseOracleOutcome(text)).toBe(2500);
  });

  it("returns 5000 (uncertain) when nothing parseable found", () => {
    expect(parseOracleOutcome("no numbers at all here")).toBe(5000);
    expect(parseOracleOutcome("")).toBe(5000);
  });

  it("handles the exact text that triggered the round-3 parser bug", () => {
    const text = `dence consistently shows Bitcoin's current spot price is well below $100,000 - around $81,000-$82,000 range. There is no evidence suggesting the current price is above $100,000. The question asks if the CURRENT spot price is above $100,000, and all current data shows it is not.

The evidence is clear, consistent, and unambiguous: Bitcoin's current spot price is NOT above $100,000.

FINAL_ANSWER: 0`;
    expect(parseOracleOutcome(text)).toBe(0);
  });
});

describe("clampOutcome", () => {
  it("clamps to [0, 10000]", () => {
    expect(clampOutcome(-5)).toBe(0);
    expect(clampOutcome(20_000)).toBe(10_000);
    expect(clampOutcome(5000)).toBe(5000);
  });

  it("returns 5000 for NaN/Infinity", () => {
    expect(clampOutcome(NaN)).toBe(5000);
    expect(clampOutcome(Infinity)).toBe(5000);
  });

  it("rounds fractional inputs", () => {
    expect(clampOutcome(123.4)).toBe(123);
    expect(clampOutcome(123.6)).toBe(124);
  });
});
