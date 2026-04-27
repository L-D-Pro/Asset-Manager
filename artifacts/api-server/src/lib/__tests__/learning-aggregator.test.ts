import { describe, expect, it } from "vitest";
import { aggregateVariantStats } from "../learning-aggregator";

describe("aggregateVariantStats", () => {
  it("groups outcomes by prompt version", () => {
    const mockSignals = [
      { outcome: "offer", promptVersionId: 1 },
      { outcome: "rejected", promptVersionId: 1 },
      { outcome: "offer", promptVersionId: 2 },
      { outcome: "ghosted", promptVersionId: 2 },
    ];

    const result = aggregateVariantStats(mockSignals);

    expect(result).toHaveLength(2);
    const v1 = result.find((r) => r.variantId === 1 && r.variantType === "prompt")!;
    expect(v1.successes).toBe(1); // offer = success
    expect(v1.failures).toBe(1);  // rejected = failure
    expect(v1.pending).toBe(0);

    const v2 = result.find((r) => r.variantId === 2 && r.variantType === "prompt")!;
    expect(v2.successes).toBe(1); // offer = success
    expect(v2.failures).toBe(0);
    expect(v2.pending).toBe(1);   // ghosted = pending
  });

  it("returns empty array for empty input", () => {
    expect(aggregateVariantStats([])).toEqual([]);
  });

  it("skips signals without prompt version id", () => {
    const mockSignals = [
      { outcome: "offer", promptVersionId: null },
      { outcome: "rejected", promptVersionId: 1 },
    ];

    const result = aggregateVariantStats(mockSignals);
    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe(1);
    expect(result[0].successes).toBe(0);
    expect(result[0].failures).toBe(1);
  });

  it("treats 'hired' as a success", () => {
    const mockSignals = [
      { outcome: "hired", promptVersionId: 1 },
    ];

    const result = aggregateVariantStats(mockSignals);
    expect(result).toHaveLength(1);
    expect(result[0].successes).toBe(1);
    expect(result[0].failures).toBe(0);
  });

  it("treats unknown outcomes as pending", () => {
    const mockSignals = [
      { outcome: "phone_screen", promptVersionId: 1 },
      { outcome: "interview", promptVersionId: 1 },
    ];

    const result = aggregateVariantStats(mockSignals);
    expect(result[0].pending).toBe(2);
    expect(result[0].successes).toBe(0);
    expect(result[0].failures).toBe(0);
  });

  it("aggregates multiple signals for same prompt version", () => {
    const mockSignals = [
      { outcome: "offer", promptVersionId: 1 },
      { outcome: "hired", promptVersionId: 1 },
      { outcome: "rejected", promptVersionId: 1 },
      { outcome: "ghosted", promptVersionId: 1 },
      { outcome: "offer", promptVersionId: 1 },
    ];

    const result = aggregateVariantStats(mockSignals);
    expect(result).toHaveLength(1);
    expect(result[0].successes).toBe(3); // offer + hired + offer
    expect(result[0].failures).toBe(1);  // rejected
    expect(result[0].pending).toBe(1);   // ghosted
  });
});
