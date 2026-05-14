import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  aiPromptVersionsTable: {},
  aiTrainingExamplesTable: {},
}));

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { buildRoleBlock } from "../prompt-router";

describe("buildRoleBlock", () => {
  it("returns empty string when all role fields are null/empty", () => {
    expect(
      buildRoleBlock({
        roleLabel: null,
        personality: null,
        goals: null,
        skillTags: [],
      }),
    ).toBe("");
    expect(
      buildRoleBlock({
        roleLabel: "",
        personality: "",
        goals: "",
        skillTags: [],
      }),
    ).toBe("");
    expect(
      buildRoleBlock({
        roleLabel: null,
        personality: null,
        goals: null,
        skillTags: null,
      }),
    ).toBe("");
  });

  it("formats a complete role block with all four sections plus separator", () => {
    const block = buildRoleBlock({
      roleLabel: "Resume Expert",
      personality:
        "You are an expert resume writer specializing in ATS-optimized, job-targeted tailoring.",
      goals:
        "Match required skills accurately. Reorder, rephrase, prune. Never invent facts.",
      skillTags: ["ats", "tailoring", "claim-attribution"],
    });
    expect(block).toContain("ROLE: Resume Expert");
    expect(block).toContain("PERSONALITY: You are an expert resume writer");
    expect(block).toContain("GOALS: Match required skills");
    expect(block).toContain("SKILLS: ats, tailoring, claim-attribution");
    expect(block).toMatch(/\n---\n\n$/);
  });

  it("omits sections whose fields are empty", () => {
    const block = buildRoleBlock({
      roleLabel: "Job Researcher",
      personality: "",
      goals: "Find context for the role.",
      skillTags: [],
    });
    expect(block).toContain("ROLE: Job Researcher");
    expect(block).toContain("GOALS: Find context for the role.");
    expect(block).not.toContain("PERSONALITY:");
    expect(block).not.toContain("SKILLS:");
    expect(block).toMatch(/\n---\n\n$/);
  });
});
