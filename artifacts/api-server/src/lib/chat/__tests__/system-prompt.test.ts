import { describe, it, expect } from "vitest";

import {
  buildSystemPromptSections,
  buildSystemPrompt,
  type SystemPromptInputs,
} from "../system-prompt";

const baseInputs: SystemPromptInputs = {
  identityText: "IDENTITY-MARKER",
  catalog: [],
  skills: [
    { slug: "resume-ats-optimizer", body: "ATS-BODY-MARKER" },
    { slug: "cover-letter-generator", body: "COVER-LETTER-BODY-MARKER" },
  ],
  bestPracticesText: "",
  attachments: [],
};

describe("buildSystemPromptSections", () => {
  it("returns identity + one section per skill, in order, when nothing else is set", () => {
    const sections = buildSystemPromptSections(baseInputs);
    expect(sections.map((s) => s.lever)).toEqual(["identity", "skill", "skill"]);
    expect(sections[0]!.content).toContain("IDENTITY-MARKER");
    expect(sections[1]!.label).toBe("resume-ats-optimizer");
    expect(sections[1]!.content).toContain("ATS-BODY-MARKER");
    expect(sections[2]!.label).toBe("cover-letter-generator");
  });

  it("inserts a skill_catalog section after identity when a catalog is present", () => {
    const sections = buildSystemPromptSections({
      ...baseInputs,
      catalog: [
        { slug: "resume-ats-optimizer", name: "ATS", description: "Optimize for ATS" },
        { slug: "cover-letter-generator", name: "Cover", description: "Write cover letters" },
      ],
    });
    expect(sections.map((s) => s.lever)).toEqual([
      "identity",
      "skill_catalog",
      "skill",
      "skill",
    ]);
    expect(sections[1]!.content).toContain("resume-ats-optimizer");
    expect(sections[1]!.content).toContain("Optimize for ATS");
  });

  it("omits the skill_catalog section when the catalog is empty", () => {
    const sections = buildSystemPromptSections(baseInputs);
    expect(sections.some((s) => s.lever === "skill_catalog")).toBe(false);
  });

  it("includes a best_practices section after skills when bestPracticesText is set", () => {
    const sections = buildSystemPromptSections({
      ...baseInputs,
      bestPracticesText: "BEST-PRACTICES-MARKER",
    });
    const levers = sections.map((s) => s.lever);
    expect(levers).toEqual(["identity", "skill", "skill", "best_practices"]);
    expect(sections[3]!.content).toContain("BEST-PRACTICES-MARKER");
  });

  it("omits the best_practices section when bestPracticesText is empty", () => {
    const sections = buildSystemPromptSections(baseInputs);
    expect(sections.some((s) => s.lever === "best_practices")).toBe(false);
  });

  it("appends an attachments section last when attachments are present", () => {
    const sections = buildSystemPromptSections({
      ...baseInputs,
      bestPracticesText: "BEST-PRACTICES-MARKER",
      attachments: [
        { kind: "base_resume", snapshot: { contentText: "RESUME-BODY-MARKER" } },
      ],
    });
    expect(sections[sections.length - 1]!.lever).toBe("attachments");
    expect(sections[sections.length - 1]!.content).toContain("RESUME-BODY-MARKER");
  });

  it("omits the identity section when identityText is empty", () => {
    const sections = buildSystemPromptSections({ ...baseInputs, identityText: "" });
    expect(sections.some((s) => s.lever === "identity")).toBe(false);
  });

  it("omits all skill sections when the skills array is empty", () => {
    const sections = buildSystemPromptSections({ ...baseInputs, skills: [] });
    expect(sections.some((s) => s.lever === "skill")).toBe(false);
  });
});

describe("buildSystemPromptSections — catalog excluded", () => {
  it("empty catalog produces no skill_catalog section", () => {
    const sections = buildSystemPromptSections({
      identityText: "You are a copilot.",
      catalog: [],
      skills: [],
      bestPracticesText: "",
      attachments: [],
    });
    expect(sections.every((s) => s.lever !== "skill_catalog")).toBe(true);
  });
});

describe("buildSystemPrompt — catalog excluded from prompt", () => {
  it("empty catalog produces no skill_catalog section", () => {
    const sections = buildSystemPromptSections({
      identityText: "You are a copilot.",
      catalog: [],
      skills: [],
      bestPracticesText: "",
      attachments: [],
    });
    expect(sections.every((s) => s.lever !== "skill_catalog")).toBe(true);
  });
});

describe("buildSystemPrompt", () => {
  it("joins section contents with the --- separator in order", () => {
    const out = buildSystemPrompt(baseInputs);
    const atsIdx = out.indexOf("ATS-BODY-MARKER");
    const coverIdx = out.indexOf("COVER-LETTER-BODY-MARKER");
    expect(out.indexOf("IDENTITY-MARKER")).toBeGreaterThanOrEqual(0);
    expect(atsIdx).toBeGreaterThan(0);
    expect(coverIdx).toBeGreaterThan(atsIdx);
    expect(out).toContain("\n\n---\n\n");
  });

  it("places the attachments block after the skill bodies", () => {
    const out = buildSystemPrompt({
      ...baseInputs,
      attachments: [
        { kind: "base_resume", snapshot: { contentText: "RESUME-BODY-MARKER" } },
      ],
    });
    expect(out).toContain("Attached context");
    expect(out.indexOf("Attached context")).toBeGreaterThan(
      out.indexOf("COVER-LETTER-BODY-MARKER"),
    );
  });
});
