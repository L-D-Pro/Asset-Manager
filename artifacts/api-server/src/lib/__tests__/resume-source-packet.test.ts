import { describe, expect, it } from "vitest";
import type { Claim } from "@workspace/db";
import {
  buildResumeSourcePacket,
  parseBaseResumeSources,
  parsePlainTextResumeDraft,
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

  it("marks dated experience lines as source headers", () => {
    const sources = parseBaseResumeSources([
      "EXPERIENCE",
      "Software Developer | Acme Corp | San Diego, CA | Jan 2021 - Present",
      "Built React workflows for 40 users.",
    ].join("\n"));

    expect(sources[0]).toMatchObject({
      ref: "base:experience:b001",
      kind: "header",
    });
    expect(sources[1]).toMatchObject({
      ref: "base:experience:b002",
      kind: "detail",
    });
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

  it("parses source-tagged plain-text resume drafts", () => {
    const packet = buildResumeSourcePacket({
      templateId: "software_developer",
      baseResumeText: [
        "SUMMARY",
        "Senior instructional designer with 13 years of experience.",
        "EXPERIENCE",
        "Senior Instructional Designer | Acme Health | San Diego, CA | Jan 2021 - Present",
        "Built 26 WCAG-compliant modules.",
        "EDUCATION",
        "B.A. Psychology - CSU Stanislaus",
        "SKILLS",
        "Storyline, Captivate, SCORM/xAPI",
      ].join("\n"),
      claims: [claim({ id: 22 })],
    });

    const result = parsePlainTextResumeDraft([
      "HEADER",
      "Cyrus Sepasi",
      "",
      "SUMMARY",
      "Senior instructional designer with 13 years of experience. [src:base:summary:b001]",
      "",
      "EXPERIENCE",
      "Senior Instructional Designer | Acme Health | San Diego, CA | Jan 2021 - Present [src:base:experience:b001]",
      "- Built 26 WCAG-compliant modules for public-sector learners. [src:base:experience:b002]",
      "Improved onboarding ramp time by 20%. [src:claim:22]",
      "",
      "EDUCATION",
      "B.A. Psychology - CSU Stanislaus [src:base:education:b001]",
      "",
      "SKILLS",
      "Tools: Storyline, Captivate, SCORM/xAPI [src:base:skills:b001]",
    ].join("\n"), packet);

    expect(result.validation.passed).toBe(true);
    expect(result.items.map((item) => item.text)).toContain("Senior Instructional Designer | Acme Health | San Diego, CA | Jan 2021 - Present");
    expect(result.validation.claimBackedCount).toBe(1);
    expect(result.diagnostics.validSourceTagCount).toBeGreaterThan(0);
    expect(result.diagnostics.sectionCounts.experience).toBe(3);
  });

  it("rejects directive text and reports invalid source tags without crashing", () => {
    const packet = buildResumeSourcePacket({
      templateId: "software_developer",
      baseResumeText: "EXPERIENCE\nBuilt SCORM packages.",
      claims: [claim({ id: 22 })],
    });

    const result = parsePlainTextResumeDraft([
      "SUMMARY",
      "Highlight the candidate's learning background. [src:claim:22]",
      "EXPERIENCE",
      "Built SCORM packages. [src:base:experience:b001]",
      "Invented unsupported content. [src:base:nope:b999]",
    ].join("\n"), packet);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.text).toBe("Built SCORM packages.");
    expect(result.validation.invalidItemCount).toBe(2);
    expect(result.diagnostics.invalidSourceTagCount).toBe(0);
  });
});
