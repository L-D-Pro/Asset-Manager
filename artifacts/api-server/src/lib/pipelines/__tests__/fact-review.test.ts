import { describe, it, expect } from "vitest";
import type { Claim } from "@workspace/db";
import { reviewFacts } from "../fact-review";

function makeClaim(partial: Partial<Claim> & Pick<Claim, "summary">): Claim {
  return {
    id: 1,
    summary: partial.summary,
    evidence: partial.evidence ?? null,
    evidenceType: partial.evidenceType ?? "self_attestation",
    phrasingVariants: partial.phrasingVariants ?? [],
    disallowedImplications: partial.disallowedImplications ?? [],
    domain: partial.domain ?? null,
    applicableTags: partial.applicableTags ?? [],
    isActive: partial.isActive ?? true,
    createdAt: partial.createdAt ?? new Date(),
    updatedAt: partial.updatedAt ?? new Date(),
  } as Claim;
}

describe("reviewFacts", () => {
  it("flags a company name not in the sources", () => {
    const result = reviewFacts({
      tailoredText: "Senior Engineer at Acme Corp from Jan 2020 to Dec 2022.",
      baseResumeText: "Senior Engineer at Globex from Jan 2020 to Dec 2022.",
      claims: [],
    });
    expect(
      result.findings.some(
        (f) => f.kind === "company" && f.value === "Acme Corp",
      ),
    ).toBe(true);
  });

  it("flags a metric not in any source", () => {
    const result = reviewFacts({
      tailoredText: "Increased revenue by 87% in six months.",
      baseResumeText: "Increased revenue significantly.",
      claims: [],
    });
    expect(
      result.findings.some(
        (f) => f.kind === "metric" && f.value.includes("87"),
      ),
    ).toBe(true);
  });

  it("does not flag a metric that appears in a claim", () => {
    const result = reviewFacts({
      tailoredText: "Improved pass rates from 70% to 90%.",
      baseResumeText: "",
      claims: [makeClaim({ summary: "Pass rates rose from 70% to 90%" })],
    });
    expect(result.findings.some((f) => f.kind === "metric")).toBe(false);
  });

  it("does not flag dates that appear in base resume", () => {
    const result = reviewFacts({
      tailoredText: "Worked there from Mar 2022 to Sep 2025.",
      baseResumeText: "Mar 2022 - Sep 2025",
      claims: [],
    });
    expect(result.findings.some((f) => f.kind === "date")).toBe(false);
  });

  it("returns no findings when all facts are supported", () => {
    const result = reviewFacts({
      tailoredText: "Engineer at Globex. Increased revenue by 40%. Mar 2022 - Sep 2025.",
      baseResumeText: "Senior Engineer at Globex | Increased revenue by 40% | Mar 2022 - Sep 2025",
      claims: [],
    });
    expect(result.findings).toEqual([]);
  });
});
