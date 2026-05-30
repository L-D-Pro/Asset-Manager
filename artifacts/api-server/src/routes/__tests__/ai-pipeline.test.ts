import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => {
  const dbMock = {
    select: vi.fn(),
  };
  return {
    db: dbMock,
    aiPromptVersionsTable: {
      id: "ai_prompt_versions.id",
      taskScope: "ai_prompt_versions.task_scope",
      isActive: "ai_prompt_versions.is_active",
      label: "ai_prompt_versions.label",
      roleLabel: "ai_prompt_versions.role_label",
      version: "ai_prompt_versions.version",
    },
    aiModelConfigsTable: {
      id: "ai_model_configs.id",
      taskScope: "ai_model_configs.task_scope",
      isActive: "ai_model_configs.is_active",
      modelName: "ai_model_configs.model_name",
      priority: "ai_model_configs.priority",
    },
    aiTrainingExamplesTable: {
      id: "ai_training_examples.id",
      userId: "ai_training_examples.user_id",
      taskScope: "ai_training_examples.task_scope",
      isActive: "ai_training_examples.is_active",
    },
    bestPracticesTable: {
      domain: "best_practices.domain",
      items: "best_practices.items",
      hardcodedGuards: "best_practices.hardcoded_guards",
    },
  };
});

import { db } from "@workspace/db";

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.payload = payload;
    return res;
  });
  return res;
}

const KNOWN_TASK_SCOPES = [
  "chat",
  "skill_routing",
  "jd_parsing",
  "claim_generation",
  "gap_analysis",
  "resume_tailoring",
  "cover_letter",
  "job_research",
  "market_research",
  "proposal_drafting",
];

async function invokeOverview() {
  const { default: router } = await import("../ai-pipeline");
  const layer = (router as any).stack.find(
    (l: any) =>
      l.route?.path === "/ai-pipeline/overview" && l.route?.methods?.get,
  );
  expect(layer).toBeTruthy();
  const handler = layer.route.stack[0].handle;
  const req: any = { session: { adminId: 27 } };
  const res = makeRes();
  await handler(req, res);
  return { res };
}

describe("GET /ai-pipeline/overview", () => {
  it("returns one row per known task scope, including those without DB rows", async () => {
    const selectMock = db.select as unknown as ReturnType<typeof vi.fn>;

    // 1. Active prompt versions: return one for resume_tailoring
    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => [
          {
            id: 7,
            taskScope: "resume_tailoring",
            label: "v2-rt",
            roleLabel: "Resume Expert",
          },
        ],
      }),
    });

    // 2. Active model configs: return one for cover_letter
    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => [
          {
            id: 3,
            taskScope: "cover_letter",
            modelName: "anthropic/claude-3.5-haiku",
          },
        ],
      }),
    });

    // 3. Best practices rows (all domains)
    selectMock.mockReturnValueOnce({
      from: () => [
        {
          domain: "general",
          items: [{ description: "a" }, { description: "b" }],
          hardcodedGuards: {},
        },
        {
          domain: "resume_tailoring",
          items: [{ description: "x" }],
          hardcodedGuards: {},
        },
      ],
    });

    // 4. Training examples grouped by taskScope
    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          groupBy: () => [
            { taskScope: "resume_tailoring", count: 5 },
            { taskScope: "cover_letter", count: 2 },
          ],
        }),
      }),
    });

    const { res } = await invokeOverview();

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Array<{ taskScope: string }>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(KNOWN_TASK_SCOPES.length);
    const scopes = payload.map((r) => r.taskScope);
    for (const scope of KNOWN_TASK_SCOPES) {
      expect(scopes).toContain(scope);
    }
  });

  it("reports counts and active labels per task with domain-mapped best practices", async () => {
    const selectMock = db.select as unknown as ReturnType<typeof vi.fn>;

    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => [
          {
            id: 7,
            taskScope: "resume_tailoring",
            label: "v2-rt",
            roleLabel: "Resume Expert",
          },
          {
            id: 8,
            taskScope: "cover_letter",
            label: "v3-cl",
            roleLabel: "Cover Letter Strategist",
          },
        ],
      }),
    });

    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => [
          {
            id: 3,
            taskScope: "resume_tailoring",
            modelName: "anthropic/claude-3.5-sonnet",
          },
        ],
      }),
    });

    selectMock.mockReturnValueOnce({
      from: () => [
        {
          domain: "general",
          items: [{ description: "g1" }, { description: "g2" }, { description: "g3" }],
          hardcodedGuards: {},
        },
        {
          domain: "resume_tailoring",
          items: [{ description: "rt1" }, { description: "rt2" }],
          hardcodedGuards: {},
        },
        {
          domain: "cover_letter",
          items: [{ description: "cl1" }],
          hardcodedGuards: {},
        },
      ],
    });

    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          groupBy: () => [
            { taskScope: "resume_tailoring", count: 5 },
          ],
        }),
      }),
    });

    const { res } = await invokeOverview();
    const payload = res.payload as Array<{
      taskScope: string;
      activePromptVersionId: number | null;
      activePromptLabel: string | null;
      roleLabel: string | null;
      modelName: string | null;
      modelConfigId: number | null;
      bestPracticesEnabledCount: number;
      trainingExampleCount: number;
    }>;

    const resume = payload.find((r) => r.taskScope === "resume_tailoring");
    expect(resume).toBeDefined();
    expect(resume!.activePromptVersionId).toBe(7);
    expect(resume!.activePromptLabel).toBe("v2-rt");
    expect(resume!.roleLabel).toBe("Resume Expert");
    expect(resume!.modelName).toBe("anthropic/claude-3.5-sonnet");
    expect(resume!.modelConfigId).toBe(3);
    expect(resume!.bestPracticesEnabledCount).toBe(2);
    expect(resume!.trainingExampleCount).toBe(5);

    const cover = payload.find((r) => r.taskScope === "cover_letter");
    expect(cover).toBeDefined();
    expect(cover!.bestPracticesEnabledCount).toBe(1);
    expect(cover!.activePromptLabel).toBe("v3-cl");
    expect(cover!.modelName).toBeNull();
    expect(cover!.trainingExampleCount).toBe(0);

    const jdp = payload.find((r) => r.taskScope === "jd_parsing");
    expect(jdp).toBeDefined();
    expect(jdp!.activePromptVersionId).toBeNull();
    expect(jdp!.bestPracticesEnabledCount).toBe(3); // general domain
    expect(jdp!.trainingExampleCount).toBe(0);
  });
});
