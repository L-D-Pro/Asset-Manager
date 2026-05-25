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
