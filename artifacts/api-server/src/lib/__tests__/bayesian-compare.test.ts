import { describe, expect, it } from "vitest";
import { compareVariants } from "../bayesian-compare";

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
