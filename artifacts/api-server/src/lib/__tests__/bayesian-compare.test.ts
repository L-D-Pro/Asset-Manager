import { describe, expect, it } from "vitest";
import { compareVariants, confidence, isWinner } from "../bayesian-compare";

describe("compareVariants", () => {
  it("returns high P(A > B) when A has many more successes", () => {
    // A: 10 successes, 1 failure → Beta(11, 2) centered near 0.85
    // B: 1 success, 10 failures → Beta(2, 11) centered near 0.15
    const p = compareVariants(
      { successes: 10, failures: 1 },
      { successes: 1, failures: 10 },
    );
    expect(p).toBeGreaterThan(0.95);
  });

  it("returns near 0.5 when variants have identical stats", () => {
    const p = compareVariants(
      { successes: 5, failures: 5 },
      { successes: 5, failures: 5 },
    );
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
  });

  it("returns low P(A > B) when A has many more failures", () => {
    const p = compareVariants(
      { successes: 1, failures: 10 },
      { successes: 10, failures: 1 },
    );
    expect(p).toBeLessThan(0.05);
  });

  it("handles zero successes and zero failures (uniform prior)", () => {
    const p = compareVariants(
      { successes: 0, failures: 0 },
      { successes: 10, failures: 1 },
    );
    expect(p).toBeLessThan(0.3);
  });

  it("returns near 0.5 with equal large samples", () => {
    const p = compareVariants(
      { successes: 50, failures: 50 },
      { successes: 50, failures: 50 },
    );
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.55);
  });
});

describe("confidence", () => {
  it("returns > 0.95 when A is clearly better", () => {
    const c = confidence(
      { successes: 20, failures: 2 },
      { successes: 2, failures: 20 },
    );
    expect(c).toBeGreaterThan(0.95);
  });

  it("returns near 0.5 when variants are equal", () => {
    const c = confidence(
      { successes: 10, failures: 10 },
      { successes: 10, failures: 10 },
    );
    expect(c).toBeGreaterThan(0.4);
    expect(c).toBeLessThan(0.6);
  });
});

describe("isWinner", () => {
  it("returns true when A has enough data and clearly better", () => {
    const result = isWinner(
      { successes: 20, failures: 2 },
      { successes: 2, failures: 20 },
      { confidence: 0.95, minSampleSize: 10, minImprovementMargin: 0.05 },
    );
    expect(result).toBe(true);
  });

  it("returns false when sample size too low", () => {
    const result = isWinner(
      { successes: 8, failures: 1 },
      { successes: 1, failures: 8 },
      { confidence: 0.95, minSampleSize: 10, minImprovementMargin: 0.05 },
    );
    expect(result).toBe(false);
  });

  it("returns false when improvement margin too small", () => {
    const result = isWinner(
      { successes: 11, failures: 9 },
      { successes: 10, failures: 10 },
      { confidence: 0.95, minSampleSize: 10, minImprovementMargin: 0.05 },
    );
    expect(result).toBe(false);
  });

  it("returns false when confidence too low", () => {
    const result = isWinner(
      { successes: 12, failures: 8 },
      { successes: 8, failures: 12 },
      { confidence: 0.99, minSampleSize: 10, minImprovementMargin: 0.05 },
    );
    expect(result).toBe(false);
  });
});
