import { describe, it, expect, vi } from "vitest";

const { dbSelectMock } = vi.hoisted(() => ({ dbSelectMock: vi.fn() }));

vi.mock("@workspace/db", () => ({
  db: { select: dbSelectMock },
  aiPromptVersionsTable: {
    taskScope: "prompt.task_scope",
    isActive: "prompt.is_active",
    version: "prompt.version",
  },
  aiTrainingExamplesTable: {
    approvedOutput: "training.approved_output",
    taskScope: "training.task_scope",
    isActive: "training.is_active",
    userId: "training.user_id",
    qualityScore: "training.quality_score",
  },
}));

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { buildRoleBlock, resolvePromptForTask } from "../prompt-router";

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

describe("tenant-scoped few-shot examples", () => {
  it("does not query private training examples without an owning user", async () => {
    dbSelectMock.mockReset();
    dbSelectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => [] }),
        }),
      }),
    });

    const resolved = await resolvePromptForTask("resume_tailoring", "system", "input");

    expect(dbSelectMock).toHaveBeenCalledTimes(1);
    expect(resolved.userPrompt).toBe("input");
  });

  it("uses examples only through an owner-scoped query", async () => {
    dbSelectMock.mockReset();
    dbSelectMock
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => [] }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => [{ approvedOutput: "Owner 27 approved output" }],
            }),
          }),
        }),
      });

    const resolved = await resolvePromptForTask("resume_tailoring", "system", "input", 27);

    expect(dbSelectMock).toHaveBeenCalledTimes(2);
    expect(resolved.userPrompt).toContain("Owner 27 approved output");
  });
});
