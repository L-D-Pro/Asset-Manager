import { describe, it, expect } from "vitest";

import { validateChatOutput } from "../output-validator";

describe("validateChatOutput", () => {
  it("passes a normal response", () => {
    const r = validateChatOutput("Here is a tailored summary for the role.");
    expect(r.lengthOk).toBe(true);
    expect(r.formatOk).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("flags empty / whitespace-only output", () => {
    const r = validateChatOutput("   \n  ");
    expect(r.lengthOk).toBe(false);
    expect(r.warnings.some((w) => /empty/i.test(w))).toBe(true);
  });

  it("flags output over the length ceiling", () => {
    const r = validateChatOutput("a".repeat(32_001));
    expect(r.lengthOk).toBe(false);
    expect(r.warnings.some((w) => /exceeds/i.test(w))).toBe(true);
  });

  it("accepts balanced code fences", () => {
    const r = validateChatOutput("```ts\nconst x = 1;\n```");
    expect(r.formatOk).toBe(true);
  });

  it("flags unbalanced code fences", () => {
    const r = validateChatOutput("Here is code:\n```ts\nconst x = 1;");
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /fence/i.test(w))).toBe(true);
  });

  it("flags leaked system-prompt scaffolding", () => {
    const r = validateChatOutput("## Skill: resume-ats-optimizer\n\nyou are…");
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /scaffolding/i.test(w))).toBe(true);
  });
});

describe("validateChatOutput — resume-specific checks (tailored-resume-generator slug)", () => {
  const resumeOpts = { selectedSlugs: ["tailored-resume-generator"] };

  it("passes a normal concise resume output", () => {
    const r = validateChatOutput("Here is your tailored resume:\n\n- Built X\n- Led Y", resumeOpts);
    expect(r.formatOk).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("flags process leakage — STEP 1", () => {
    const r = validateChatOutput("STEP 1: Extract keywords", resumeOpts);
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(true);
  });

  it("flags process leakage — JD KEYWORD EXTRACTION", () => {
    const r = validateChatOutput("JD KEYWORD EXTRACTION\n...", resumeOpts);
    expect(r.formatOk).toBe(false);
  });

  it("flags process leakage — I'll work through", () => {
    const r = validateChatOutput("I'll work through the JD first.", resumeOpts);
    expect(r.formatOk).toBe(false);
  });

  it("flags process leakage — internal audit", () => {
    const r = validateChatOutput("Running internal audit of your skills.", resumeOpts);
    expect(r.formatOk).toBe(false);
  });

  it("flags over-budget bullet count (>25 bullets)", () => {
    const manyBullets = Array.from({ length: 26 }, (_, i) => `- bullet ${i + 1}`).join("\n");
    const r = validateChatOutput(manyBullets, resumeOpts);
    expect(r.warnings.some((w) => /bullet count/i.test(w))).toBe(true);
  });

  it("does not flag 25 or fewer bullets", () => {
    const bullets = Array.from({ length: 25 }, (_, i) => `- bullet ${i + 1}`).join("\n");
    const r = validateChatOutput(bullets, resumeOpts);
    expect(r.warnings.some((w) => /bullet count/i.test(w))).toBe(false);
  });

  it("flags tables inside resume", () => {
    const r = validateChatOutput("| Skill | Level |\n| ----- | ----- |", resumeOpts);
    expect(r.warnings.some((w) => /tables detected/i.test(w))).toBe(true);
  });

  it("flags excessive separators", () => {
    const r = validateChatOutput("Section\n-----\nContent", resumeOpts);
    expect(r.warnings.some((w) => /separator/i.test(w))).toBe(true);
  });
});

describe("validateChatOutput — resume checks do NOT apply for non-resume slugs", () => {
  it("does not flag process leakage for general chat (no slug)", () => {
    const r = validateChatOutput("STEP 1: Here is my answer.");
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(false);
  });

  it("does not flag process leakage for cover-letter slug", () => {
    const r = validateChatOutput("STEP 1: Let me write your cover letter.", { selectedSlugs: ["cover-letter"] });
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(false);
  });
});

describe("validateChatOutput — resume checks apply for tailored-resume-generator (current routing slug)", () => {
  const resumeOpts = { selectedSlugs: ["tailored-resume-generator"] };

  it("flags process leakage — STEP 1", () => {
    const r = validateChatOutput("STEP 1: Extract keywords from the JD.", resumeOpts);
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(true);
  });

  it("flags process leakage — JD KEYWORD EXTRACTION", () => {
    const r = validateChatOutput("JD KEYWORD EXTRACTION\n...", resumeOpts);
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(true);
  });

  it("flags process leakage — MAPPING CANDIDATE EXPERIENCE", () => {
    const r = validateChatOutput("MAPPING CANDIDATE EXPERIENCE to role...", resumeOpts);
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(true);
  });

  it("flags over-budget bullet count", () => {
    const manyBullets = Array.from({ length: 26 }, (_, i) => `- bullet ${i + 1}`).join("\n");
    const r = validateChatOutput(manyBullets, resumeOpts);
    expect(r.warnings.some((w) => /bullet count/i.test(w))).toBe(true);
  });

  it("passes clean resume output", () => {
    const r = validateChatOutput("Here is your tailored resume:\n\n- Built X\n- Led Y", resumeOpts);
    expect(r.warnings.filter((w) => /process leakage/i.test(w))).toEqual([]);
  });
});

describe("validateChatOutput — resume checks apply for resume-ats-optimizer (current routing slug)", () => {
  const resumeOpts = { selectedSlugs: ["resume-ats-optimizer"] };

  it("flags process leakage — STEP 1", () => {
    const r = validateChatOutput("STEP 1: Run ATS keyword scan.", resumeOpts);
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(true);
  });

  it("flags process leakage — internal audit", () => {
    const r = validateChatOutput("Running internal audit of your resume.", resumeOpts);
    expect(r.formatOk).toBe(false);
    expect(r.warnings.some((w) => /process leakage/i.test(w))).toBe(true);
  });
});
