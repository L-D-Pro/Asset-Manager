import { describe, it, expect } from "vitest";

import { classifyIntent, resolvePrimarySkill } from "../intent-classifier";
import type { LoadedSkill } from "../skill-loader";

describe("classifyIntent", () => {
  it.each([
    ["write me a cover letter for this", "cover-letter-generator"],
    ["draft an application letter", "cover-letter-generator"],
    ["letter for the Senior PM role", "cover-letter-generator"],
    ["optimize my resume for ATS", "resume-ats-optimizer"],
    ["check my CV for keyword match", "resume-ats-optimizer"],
    ["my applications aren't getting interviews", "resume-ats-optimizer"],
    ["tailor my resume for this JD", "tailored-resume-generator"],
    ["create a tailored resume", "tailored-resume-generator"],
    ["customize my resume for the senior PM role", "tailored-resume-generator"],
    ["I want both a tailored resume AND cover letter", "cover-letter-generator"],
    ["hi", "general"],
    ["what should I do next?", "general"],
  ])("classifies %j as %s", (input, expected) => {
    expect(classifyIntent(input)).toBe(expected);
  });
});

describe("resolvePrimarySkill", () => {
  const fakeSkills: LoadedSkill[] = [
    { slug: "resume-ats-optimizer", name: "ATS", description: "", body: "" },
    { slug: "cover-letter-generator", name: "Cover Letter", description: "", body: "" },
  ];

  it("returns the matching skill by slug", () => {
    expect(resolvePrimarySkill(fakeSkills, "cover-letter-generator").slug).toBe(
      "cover-letter-generator",
    );
  });

  it("falls back to first skill when slug is 'general'", () => {
    expect(resolvePrimarySkill(fakeSkills, "general").slug).toBe("resume-ats-optimizer");
  });

  it("throws when an unknown slug is requested", () => {
    expect(() => resolvePrimarySkill(fakeSkills, "missing" as never)).toThrow();
  });
});
