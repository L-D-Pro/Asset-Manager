import { describe, expect, it } from "vitest";
import type { Claim } from "@workspace/db";
import {
  buildResumeSourcePacket,
  parseBaseResumeSources,
  validateResumeTailoringPlan,
} from "../resume-source-packet";

function claim(overrides: Partial<Claim>): Claim {
  return {
    id: 7,
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

describe("resume source packet", () => {
  it("parses base resume sections into stable source refs", () => {
    const sources = parseBaseResumeSources([
      "CYRUS SEPASI",
      "PROFESSIONAL SUMMARY",
      "Instructional designer with 13 years of experience.",
      "EXPERIENCE",
      "Built 26 WCAG-compliant modules for a certification program.",
      "SKILLS",
      "Storyline, Captivate, SCORM/xAPI",
    ].join("\n"));

    expect(sources.map((source) => source.ref)).toContain("base:summary:b001");
    expect(sources.map((source) => source.ref)).toContain("base:experience:b001");
    expect(sources.map((source) => source.ref)).toContain("base:skills:b001");
  });

  it("accepts claim and base refs from the packet", () => {
    const packet = buildResumeSourcePacket({
      templateId: "software_developer",
      baseResumeText: "EXPERIENCE\nBuilt 26 WCAG-compliant modules.",
      claims: [claim({ id: 12 })],
    });

    const result = validateResumeTailoringPlan({
      summary: "ok",
      sectionItems: [
        {
          section: "experience",
          text: "Built 26 WCAG-compliant learning modules.",
          sourceRefs: ["base:experience:b001"],
          jobKeywordsUsed: ["WCAG"],
          gapNotes: [],
        },
        {
          section: "summary",
          text: "Reduced onboarding ramp time by 20% for 40 employees.",
          sourceRefs: ["claim:12"],
          jobKeywordsUsed: ["onboarding"],
          gapNotes: [],
        },
      ],
    }, packet);

    expect(result.validation.passed).toBe(true);
    expect(result.validation.validItemCount).toBe(2);
    expect(result.validation.claimBackedCount).toBe(1);
    expect(result.validation.baseBackedCount).toBe(1);
  });

  it("rejects missing, unknown, and template-invalid refs", () => {
    const packet = buildResumeSourcePacket({
      templateId: "data_engineer",
      baseResumeText: "EXPERIENCE\nBuilt ETL checks for 12 pipelines.",
      claims: [claim({ id: 4 })],
    });

    const result = validateResumeTailoringPlan({
      summary: "bad refs",
      sectionItems: [
        {
          section: "coursework",
          text: "Completed algorithms coursework.",
          sourceRefs: ["base:coursework:b001"],
          jobKeywordsUsed: [],
          gapNotes: [],
        },
        {
          section: "experience",
          text: "Invented 99 dashboards.",
          sourceRefs: ["claim:999"],
          jobKeywordsUsed: [],
          gapNotes: [],
        },
      ],
    }, packet);

    expect(result.validation.passed).toBe(false);
    expect(result.items).toHaveLength(0);
    expect(result.validation.invalidItemCount).toBe(2);
  });
});
