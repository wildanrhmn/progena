import { describe, it, expect } from "vitest";
import { extractPrediction, PredictionParseError } from "./prediction.js";

describe("extractPrediction", () => {
  it("parses a clean PREDICTION line", () => {
    expect(extractPrediction("Some reasoning.\nPREDICTION: 7200")).toEqual(7200);
  });

  it("accepts case variants and equals separator", () => {
    expect(extractPrediction("prediction = 4500")).toEqual(4500);
    expect(extractPrediction("Final Prediction: 8800")).toEqual(8800);
    expect(extractPrediction("ANSWER: 100")).toEqual(100);
  });

  it("clamps below the minimum", () => {
    expect(extractPrediction("PREDICTION: -50")).toEqual(0);
  });

  it("clamps above the maximum", () => {
    expect(extractPrediction("PREDICTION: 99999")).toEqual(10_000);
  });

  it("falls back to a percentage when no explicit line is present", () => {
    expect(extractPrediction("I think the probability is about 73%.")).toEqual(7300);
  });

  it("falls back to a trailing integer when nothing else matches", () => {
    expect(extractPrediction("My final number is 6400")).toEqual(6400);
  });

  it("prefers an explicit PREDICTION line over a percentage in the body", () => {
    expect(
      extractPrediction("There's about a 30% chance.\nPREDICTION: 4200")
    ).toEqual(4200);
  });

  it("rejects empty input", () => {
    expect(() => extractPrediction("")).toThrow(PredictionParseError);
    expect(() => extractPrediction("   ")).toThrow(PredictionParseError);
  });

  it("rejects input with no number at all", () => {
    expect(() => extractPrediction("I have no idea, sorry.")).toThrow(PredictionParseError);
  });

  it("rounds fractional percentages", () => {
    expect(extractPrediction("Estimate: 12.7%")).toEqual(1270);
  });
});
