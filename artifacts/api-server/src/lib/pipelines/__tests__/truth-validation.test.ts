import { describe, expect, it, vi } from "vitest";
import { checkNoMarkdown, checkQuantifiedImpact, reviewGeneratedTruth } from "../validation";
import type { Claim } from "@workspace/db";

vi.mock("../../ai-client", () => ({
  callAI: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

const claims = [
  {
    id: 1,
    summary: "Led onboarding program for 40 employees and reduced ramp time by 20%",
    evidence: "Program report confirms 40 employees and 20% faster ramp time.",
    evidenceType: "document",
    phrasingVariants: ["employee onboarding", "ramp time reduction"],
    disallowedImplications: ["sole founder", "certified trainer"],
    domain: "learning",
    applicableTags: ["onboarding", "training"],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
] as Claim[];

describe("truth validation", () => {
  it("passes a supported rewrite with existing metrics", () => {
    const review = reviewGeneratedTruth(
      [
        {
          text: "Led onboarding for 40 employees, reducing ramp time by 20%.",
          claimIds: [1],
          jobKeywordsUsed: ["onboarding"],
        },
      ],
      { selectedClaims: claims },
    );

    expect(review.supportStatus).toBe("supported");
    expect(review.seriousViolationCount).toBe(0);
  });

  it("fails closed on invented metrics", () => {
    const review = reviewGeneratedTruth(
      [
        {
          text: "Led onboarding for 400 employees, reducing ramp time by 80%.",
          claimIds: [1],
        },
      ],
      { selectedClaims: claims },
    );

    expect(review.supportStatus).toBe("unsupported");
    expect(review.seriousViolationCount).toBeGreaterThan(0);
    expect(review.items[0]?.metricViolations).toContain("400 employees");
    expect(review.items[0]?.metricViolations).toContain("80%");
  });

  it("fails closed on disallowed implications", () => {
    const review = reviewGeneratedTruth(
      [
        {
          text: "Served as certified trainer and sole founder of the onboarding program.",
          claimIds: [1],
        },
      ],
      { selectedClaims: claims },
    );

    expect(review.supportStatus).toBe("unsupported");
    expect(review.items[0]?.disallowedImplicationViolations).toEqual([
      "sole founder",
      "certified trainer",
    ]);
  });

  it("flags unsupported company references", () => {
    const review = reviewGeneratedTruth(
      [
        {
          text: "I am excited by Acme's new satellite platform.",
          claimIds: [],
          role: "opening",
          companySourcesUsed: ["satellite platform"],
        },
      ],
      {
        selectedClaims: claims,
        jobSourceText: "Company: Acme",
        researchSourceText: "",
        allowUncitedRoles: ["opening", "closing"],
      },
    );

    expect(review.supportStatus).toBe("partial");
    expect(review.items[0]?.unsupportedPhrases).toContain(
      "Unsupported company/job reference: satellite platform",
    );
  });

  it("keeps explicit gap notes reviewable instead of hallucinated", () => {
    const review = reviewGeneratedTruth(
      [
        {
          text: "Led onboarding programs aligned to the role's training needs.",
          claimIds: [1],
          gapNotes: ["GAP: no claim available for LMS administration"],
        },
      ],
      { selectedClaims: claims },
    );

    expect(review.supportStatus).toBe("partial");
    expect(review.seriousViolationCount).toBe(0);
  });

  it("allows ATS plain-text bullets and does not require every bullet to be quantified", () => {
    expect(checkNoMarkdown("- Built accessible learning modules\n- Improved QA with templates")).toEqual([]);
    expect(
      checkQuantifiedImpact([
        { text: "Built 26 accessible learning modules." },
        { text: "Partnered with stakeholders to improve learning workflows." },
      ]),
    ).toEqual([]);
  });
});
