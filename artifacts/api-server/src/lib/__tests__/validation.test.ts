import { describe, expect, it } from "vitest";
import type { Claim } from "@workspace/db";
import {
  reviewGeneratedTruth,
  validateSemanticTemplateContract,
  validateClaimIds,
  validateBullet,
  validateParagraph,
  assertMinimumContent,
  TruthLockViolation,
  QualityViolation,
  checkNoMarkdown,
  checkNoGenericFiller,
  checkCoverLetterLength,
  checkQuantifiedImpact,
  stripClaimIdRefs,
} from "../pipelines/validation";
import {
  validateSemanticTemplateContract as validateSemanticTemplateContractFromTailor,
} from "../pipelines/resume-tailor";
import type { ValidatedResumeItem } from "../resume-source-packet";

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 1,
    summary: "Reduced onboarding ramp time by 20% for 40 employees.",
    domain: "Onboarding",
    evidence: "Internal report confirms 40 employees and 20% faster ramp.",
    phrasingVariants: [],
    applicableTags: ["onboarding"],
    disallowedImplications: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Claim;
}

function makeResumeItem(overrides: Partial<ValidatedResumeItem> = {}): ValidatedResumeItem {
  return {
    text: "Built 26 WCAG-compliant modules for a certification program.",
    section: "experience",
    claimIds: [],
    sourceRefs: ["base:experience:b001"],
    baseSourceRefs: ["base:experience:b001"],
    jobKeywordsUsed: [],
    gapNotes: [],
    sourceMap: null,
    ...overrides,
  };
}

// ─── validateSemanticTemplateContract ────────────────────────────────────────

describe("validateSemanticTemplateContract", () => {
  const templateSections = ["summary", "experience", "education", "skills"] as const;

  it("passes when all required sections are present with sufficient items", () => {
    const items: ValidatedResumeItem[] = [
      makeResumeItem({ section: "summary", text: "Senior instructional designer with 13 years of experience." }),
      makeResumeItem({ section: "experience", text: "Software Developer | Acme Corp | San Diego, CA | Jan 2021 - Present" }),
      makeResumeItem({ section: "experience", text: "Built React workflows for 40 users." }),
      makeResumeItem({ section: "education", text: "B.A. Computer Science — UC San Diego, 2019" }),
      makeResumeItem({ section: "skills", text: "TypeScript, React, Node.js, SQL" }),
      makeResumeItem({ section: "skills", text: "Git, Docker, Linux, CI/CD" }),
    ];

    const result = validateSemanticTemplateContractFromTailor({
      items,
      templateSections: [...templateSections],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.hasDatedExperience).toBe(true);
    expect(result.sectionCounts.experience).toBe(2);
    expect(result.sectionCounts.summary).toBe(1);
  });

  it("fails when experience section has fewer than 2 items", () => {
    const items: ValidatedResumeItem[] = [
      makeResumeItem({ section: "summary", text: "Senior engineer with 5 years of experience." }),
      makeResumeItem({ section: "experience", text: "Software Developer | Acme Corp | San Diego, CA | Jan 2021 - Present" }),
      makeResumeItem({ section: "education", text: "B.S. Computer Science — UC San Diego, 2019" }),
      makeResumeItem({ section: "skills", text: "TypeScript, React" }),
      makeResumeItem({ section: "skills", text: "Node.js, SQL" }),
    ];

    const result = validateSemanticTemplateContractFromTailor({
      items,
      templateSections: [...templateSections],
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => /experience.*too short/i.test(issue))).toBe(true);
  });

  it("fails when experience section has zero items", () => {
    const items: ValidatedResumeItem[] = [
      makeResumeItem({ section: "summary", text: "Senior engineer with 5 years of experience." }),
      makeResumeItem({ section: "education", text: "B.S. Computer Science — UC San Diego, 2019" }),
      makeResumeItem({ section: "skills", text: "TypeScript, React" }),
      makeResumeItem({ section: "skills", text: "Node.js, SQL" }),
    ];

    const result = validateSemanticTemplateContractFromTailor({
      items,
      templateSections: [...templateSections],
    });

    expect(result.passed).toBe(false);
    expect(result.sectionCounts.experience).toBe(0);
    expect(result.issues.some((issue) => /experience.*too short/i.test(issue))).toBe(true);
    expect(result.hasDatedExperience).toBe(false);
  });

  it("fails when summary is missing", () => {
    const items: ValidatedResumeItem[] = [
      makeResumeItem({ section: "experience", text: "Software Developer | Acme Corp | Jan 2021 - Present" }),
      makeResumeItem({ section: "experience", text: "Built React workflows for 40 users." }),
      makeResumeItem({ section: "education", text: "B.S. Computer Science — UC San Diego, 2019" }),
      makeResumeItem({ section: "skills", text: "TypeScript, React" }),
      makeResumeItem({ section: "skills", text: "Node.js, SQL" }),
    ];

    const result = validateSemanticTemplateContractFromTailor({
      items,
      templateSections: [...templateSections],
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => /summary.*missing/i.test(issue))).toBe(true);
  });

  it("fails when skills section is too short", () => {
    const items: ValidatedResumeItem[] = [
      makeResumeItem({ section: "summary", text: "Senior engineer with 5 years of experience." }),
      makeResumeItem({ section: "experience", text: "Software Developer | Acme Corp | Jan 2021 - Present" }),
      makeResumeItem({ section: "experience", text: "Built React workflows for 40 users." }),
      makeResumeItem({ section: "education", text: "B.S. Computer Science — UC San Diego, 2019" }),
      makeResumeItem({ section: "skills", text: "TypeScript" }),
    ];

    const result = validateSemanticTemplateContractFromTailor({
      items,
      templateSections: [...templateSections],
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => /skills.*too short/i.test(issue))).toBe(true);
  });

  it("flags directive language in items", () => {
    const items: ValidatedResumeItem[] = [
      makeResumeItem({ section: "summary", text: "Senior engineer with 5 years of experience." }),
      makeResumeItem({ section: "experience", text: "Highlight the candidate's project leadership and team skills." }),
      makeResumeItem({ section: "experience", text: "Software Developer | Acme Corp | Jan 2021 - Present" }),
      makeResumeItem({ section: "education", text: "B.S. Computer Science — UC San Diego, 2019" }),
      makeResumeItem({ section: "skills", text: "TypeScript, React" }),
      makeResumeItem({ section: "skills", text: "Node.js, SQL" }),
    ];

    const result = validateSemanticTemplateContractFromTailor({
      items,
      templateSections: [...templateSections],
    });

    expect(result.issues.some((issue) => /directive/i.test(issue))).toBe(true);
  });

  it("detects missing date signals in experience", () => {
    const items: ValidatedResumeItem[] = [
      makeResumeItem({ section: "summary", text: "Senior engineer with 5 years of experience." }),
      makeResumeItem({ section: "experience", text: "Software Developer at Acme Corp in San Diego" }),
      makeResumeItem({ section: "experience", text: "Built React workflows for 40 users." }),
      makeResumeItem({ section: "education", text: "B.S. Computer Science — UC San Diego, 2019" }),
      makeResumeItem({ section: "skills", text: "TypeScript, React" }),
      makeResumeItem({ section: "skills", text: "Node.js, SQL" }),
    ];

    const result = validateSemanticTemplateContractFromTailor({
      items,
      templateSections: [...templateSections],
    });

    expect(result.hasDatedExperience).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => /date/i.test(issue))).toBe(true);
  });
});

// ─── reviewGeneratedTruth ─────────────────────────────────────────────────────

describe("reviewGeneratedTruth", () => {
  const claim1 = makeClaim({
    id: 10,
    summary: "Reduced onboarding ramp time by 20% for 40 employees.",
    evidence: "Internal report confirms 40 employees and 20% faster ramp.",
    disallowedImplications: ["managed a team of 50"],
  });
  const claim2 = makeClaim({
    id: 11,
    summary: "Launched a React dashboard for 500 users.",
    evidence: "Product launch post confirms 500 users at launch.",
    disallowedImplications: [],
  });

  it("marks items as supported when all metrics appear in claim sources", () => {
    const result = reviewGeneratedTruth(
      [
        {
          text: "Reduced onboarding time by 20% for 40 employees.",
          claimIds: [10],
          role: "body",
          section: "experience",
        },
      ],
      { selectedClaims: [claim1, claim2] },
    );

    expect(result.supportStatus).toBe("supported");
    expect(result.items[0]!.metricViolations).toHaveLength(0);
    expect(result.items[0]!.disallowedImplicationViolations).toHaveLength(0);
    expect(result.seriousViolationCount).toBe(0);
  });

  it("detects metric violations when a number is not in any source", () => {
    const result = reviewGeneratedTruth(
      [
        {
          text: "Reduced onboarding time by 99% for 40 employees.",
          claimIds: [10],
          role: "body",
          section: "experience",
        },
      ],
      { selectedClaims: [claim1, claim2] },
    );

    expect(result.items[0]!.metricViolations.length).toBeGreaterThan(0);
    expect(result.items[0]!.metricViolations.some((v) => v.includes("99"))).toBe(true);
    expect(result.items[0]!.supportStatus).toBe("unsupported");
    expect(result.seriousViolationCount).toBe(1);
    expect(result.supportStatus).toBe("unsupported");
  });

  it("detects disallowed implication violations", () => {
    const result = reviewGeneratedTruth(
      [
        {
          text: "Managed a team of 50 engineers and reduced ramp time by 20%.",
          claimIds: [10],
          role: "body",
          section: "experience",
        },
      ],
      { selectedClaims: [claim1, claim2] },
    );

    expect(result.items[0]!.disallowedImplicationViolations).toContain("managed a team of 50");
    expect(result.items[0]!.supportStatus).toBe("unsupported");
    expect(result.seriousViolationCount).toBe(1);
  });

  it("flags items with no cited claim as unsupported (body role)", () => {
    const result = reviewGeneratedTruth(
      [
        {
          text: "Launched a product with 500 users.",
          claimIds: [],
          role: "body",
          section: "experience",
        },
      ],
      { selectedClaims: [claim1, claim2] },
    );

    expect(result.items[0]!.unsupportedPhrases.some((p) => /no cited claim/i.test(p))).toBe(true);
    expect(result.items[0]!.supportStatus).toBe("unsupported");
    expect(result.seriousViolationCount).toBe(1);
  });

  it("allows uncited items for opening/closing roles when configured", () => {
    const result = reviewGeneratedTruth(
      [
        {
          text: "I am excited to apply for this position.",
          claimIds: [],
          role: "opening",
          section: "summary",
        },
        {
          text: "Thank you for your consideration.",
          claimIds: [],
          role: "closing",
          section: "summary",
        },
      ],
      { selectedClaims: [claim1, claim2], allowUncitedRoles: ["opening", "closing"] },
    );

    expect(result.seriousViolationCount).toBe(0);
    expect(result.supportStatus).toBe("supported");
  });

  it("aggregates counts correctly across multiple items", () => {
    const result = reviewGeneratedTruth(
      [
        {
          text: "Reduced onboarding time by 20% for 40 employees.",
          claimIds: [10],
          role: "body",
        },
        {
          text: "Invented metric: grew revenue by 999%.",
          claimIds: [11],
          role: "body",
        },
      ],
      { selectedClaims: [claim1, claim2] },
    );

    expect(result.supportedCount).toBe(1);
    expect(result.unsupportedCount).toBe(1);
    expect(result.seriousViolationCount).toBe(1);
    expect(result.supportStatus).toBe("unsupported");
  });

  it("uses base resume text as an additional source for metric validation", () => {
    const result = reviewGeneratedTruth(
      [
        {
          text: "Delivered 13 years of experience in learning design.",
          claimIds: [],
          role: "base-backed",
          section: "summary",
        },
      ],
      {
        selectedClaims: [],
        baseResumeText: "Instructional designer with 13 years of experience in learning design.",
        allowUncitedRoles: ["base-backed"],
      },
    );

    expect(result.items[0]!.metricViolations).toHaveLength(0);
    expect(result.seriousViolationCount).toBe(0);
  });
});

// ─── validateClaimIds ─────────────────────────────────────────────────────────

describe("validateClaimIds", () => {
  const claims = [makeClaim({ id: 1 }), makeClaim({ id: 2 }), makeClaim({ id: 3 })];

  it("returns all valid IDs when no hallucinations exist", () => {
    const result = validateClaimIds([1, 2, 3], claims, "test");
    expect(result).toEqual([1, 2, 3]);
  });

  it("drops hallucinated IDs and returns only valid ones", () => {
    const result = validateClaimIds([1, 999, 2], claims, "test");
    expect(result).toEqual([1, 2]);
    expect(result).not.toContain(999);
  });

  it("returns empty array when all IDs are hallucinated", () => {
    const result = validateClaimIds([100, 200], claims, "test");
    expect(result).toEqual([]);
  });
});

// ─── validateBullet ───────────────────────────────────────────────────────────

describe("validateBullet", () => {
  const claims = [makeClaim({ id: 5 }), makeClaim({ id: 6 })];

  it("returns a valid bullet with valid claim IDs", () => {
    const result = validateBullet(
      { text: "Built React workflows for 40 users.", claimIds: [5], section: "experience" },
      claims,
    );
    expect(result).not.toBeNull();
    expect(result!.text).toBe("Built React workflows for 40 users.");
    expect(result!.claimIds).toEqual([5]);
  });

  it("returns null when text is empty", () => {
    const result = validateBullet({ text: "", claimIds: [5] }, claims);
    expect(result).toBeNull();
  });

  it("returns null when claimIds is empty", () => {
    const result = validateBullet({ text: "Some achievement.", claimIds: [] }, claims);
    expect(result).toBeNull();
  });

  it("returns null when all claim IDs are hallucinated", () => {
    const result = validateBullet({ text: "Some achievement.", claimIds: [999] }, claims);
    expect(result).toBeNull();
  });

  it("drops hallucinated IDs but keeps bullet if some valid IDs remain", () => {
    const result = validateBullet(
      { text: "Built React workflows.", claimIds: [5, 999] },
      claims,
    );
    expect(result).not.toBeNull();
    expect(result!.claimIds).toEqual([5]);
  });
});

// ─── validateParagraph ────────────────────────────────────────────────────────

describe("validateParagraph", () => {
  const claims = [makeClaim({ id: 7 }), makeClaim({ id: 8 })];

  it("validates a body paragraph with valid claim IDs", () => {
    const result = validateParagraph(
      { text: "I led a 20% improvement in onboarding efficiency.", claimIds: [7], role: "body" },
      claims,
    );
    expect(result).not.toBeNull();
    expect(result!.claimIds).toEqual([7]);
    expect(result!.role).toBe("body");
  });

  it("discards a body paragraph with no valid claim IDs", () => {
    const result = validateParagraph(
      { text: "I led a 20% improvement.", claimIds: [999], role: "body" },
      claims,
    );
    expect(result).toBeNull();
  });

  it("allows opening paragraph with no claim IDs", () => {
    const result = validateParagraph(
      { text: "I am excited to apply to your team.", claimIds: [], role: "opening" },
      claims,
    );
    expect(result).not.toBeNull();
    expect(result!.role).toBe("opening");
    expect(result!.claimIds).toEqual([]);
  });

  it("allows closing paragraph with no claim IDs", () => {
    const result = validateParagraph(
      { text: "Thank you for your consideration.", claimIds: [], role: "closing" },
      claims,
    );
    expect(result).not.toBeNull();
    expect(result!.role).toBe("closing");
  });
});

// ─── assertMinimumContent ─────────────────────────────────────────────────────

describe("assertMinimumContent", () => {
  it("does not throw when items array is non-empty", () => {
    expect(() => assertMinimumContent(["item1"], "raw content", "bullets")).not.toThrow();
  });

  it("throws TruthLockViolation when items array is empty", () => {
    expect(() => assertMinimumContent([], "raw content from AI", "bullets")).toThrow(TruthLockViolation);
  });

  it("includes context in the TruthLockViolation details", () => {
    try {
      assertMinimumContent([], "raw content from AI", "cover letter paragraphs");
      expect.fail("Expected TruthLockViolation to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TruthLockViolation);
      expect((err as TruthLockViolation).details.context).toBe("cover letter paragraphs");
    }
  });
});

// ─── Best Practices Validators ────────────────────────────────────────────────

describe("checkNoMarkdown", () => {
  it("returns no violations for plain text", () => {
    expect(checkNoMarkdown("Plain text with no markdown.")).toHaveLength(0);
  });

  it("detects bold markdown", () => {
    const violations = checkNoMarkdown("This is **bold** text.");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detects markdown headers", () => {
    const violations = checkNoMarkdown("## Summary\nSome content.");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detects inline code", () => {
    const violations = checkNoMarkdown("Used `React` for the frontend.");
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("checkNoGenericFiller", () => {
  it("returns no violations for good text", () => {
    expect(checkNoGenericFiller("Reduced onboarding ramp time by 20%.")).toHaveLength(0);
  });

  it("detects team player", () => {
    const violations = checkNoGenericFiller("I am a team player who gets results.");
    expect(violations.some((v) => v.includes("team player"))).toBe(true);
  });

  it("detects multiple filler phrases", () => {
    const violations = checkNoGenericFiller("A results-driven self-starter with synergy.");
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("checkCoverLetterLength", () => {
  it("passes when word count is 250-400 words", () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    expect(checkCoverLetterLength(words)).toHaveLength(0);
  });

  it("fails when word count is below 250", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    const violations = checkCoverLetterLength(words);
    expect(violations.some((v) => /too short/i.test(v))).toBe(true);
  });

  it("fails when word count exceeds 500", () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    const violations = checkCoverLetterLength(words);
    expect(violations.some((v) => /too long/i.test(v))).toBe(true);
  });
});

describe("checkQuantifiedImpact", () => {
  it("passes when at least one bullet contains a number", () => {
    const bullets = [
      { text: "Reduced ramp time by 20% for 40 employees." },
      { text: "Designed e-learning modules." },
    ];
    expect(checkQuantifiedImpact(bullets)).toHaveLength(0);
  });

  it("reports violation when no bullets contain numbers", () => {
    const bullets = [
      { text: "Designed e-learning modules." },
      { text: "Led cross-functional team meetings." },
    ];
    const violations = checkQuantifiedImpact(bullets);
    expect(violations.some((v) => /no quantified bullets/i.test(v))).toBe(true);
  });

  it("returns no violations for empty bullets array", () => {
    expect(checkQuantifiedImpact([])).toHaveLength(0);
  });
});

describe("stripClaimIdRefs", () => {
  it("removes parenthesized claim ID refs", () => {
    expect(stripClaimIdRefs("Led the team (ID:4) to success.")).toBe("Led the team to success.");
  });

  it("removes bracketed claim ID refs", () => {
    expect(stripClaimIdRefs("Reduced ramp time [ID:14] by 20%.")).toBe("Reduced ramp time by 20%.");
  });

  it("handles empty string", () => {
    expect(stripClaimIdRefs("")).toBe("");
  });

  it("collapses double spaces after removal", () => {
    const result = stripClaimIdRefs("Built  (ID:1)  a system.");
    expect(result).not.toContain("  ");
  });
});
