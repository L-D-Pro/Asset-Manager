import { describe, it, expect } from "vitest";

import { loadSkills, getSkillBySlug } from "../skill-loader";

describe("skill-loader", () => {
  it("loads all vendored skills with name + description from frontmatter", () => {
    const skills = loadSkills(true);
    expect(skills).toHaveLength(3);

    const ats = skills.find((s) => s.slug === "resume-ats-optimizer");
    const cover = skills.find((s) => s.slug === "cover-letter-generator");
    const tailor = skills.find((s) => s.slug === "tailored-resume-generator");
    expect(ats).toBeDefined();
    expect(cover).toBeDefined();
    expect(tailor).toBeDefined();
    expect(tailor!.body).toContain("Tailored Resume Generator");

    expect(ats!.name).toMatch(/ATS/i);
    expect(ats!.description.length).toBeGreaterThan(0);
    expect(ats!.body.length).toBeGreaterThan(500);
    expect(ats!.body.startsWith("---")).toBe(false);

    expect(cover!.name).toMatch(/cover letter/i);
    expect(cover!.body).toContain("Cover Letter");
  });

  it("memoizes results across calls when forceReload is false", () => {
    const a = loadSkills();
    const b = loadSkills();
    expect(a).toBe(b);
  });

  it("getSkillBySlug returns matching skill or throws", () => {
    expect(getSkillBySlug("resume-ats-optimizer").slug).toBe("resume-ats-optimizer");
    expect(() => getSkillBySlug("nonsense")).toThrow(/Unknown chat skill/);
  });
});
