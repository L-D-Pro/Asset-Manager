import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      adminUsersTable: {
        findFirst: vi.fn(),
      },
    },
  },
  adminUsersTable: { id: "id" },
  waitlistTable: {},
  aiModelConfigsTable: {},
  aiPromptVersionsTable: {},
  aiRunEvaluationsTable: {},
  aiTrainingExamplesTable: {},
  eventLogsTable: {},
  aiVariantStatsTable: {},
  aiVariantComparisonsTable: {},
  aiLearningConfigTable: {},
  feedbackSignalsTable: {},
  aiChatLeverConfigTable: {},
  aiChatLeverPresetsTable: {},
  insertAiPromptVersionSchema: { safeParse: vi.fn() },
  insertAiRunEvaluationSchema: { safeParse: vi.fn() },
  insertAiTrainingExampleSchema: { safeParse: vi.fn() },
  updateAiLearningConfigSchema: { safeParse: vi.fn() },
}));

vi.mock("../../lib/resend-service", () => ({
  resendService: {
    sendWaitlistConfirmation: vi.fn(),
  },
}));

vi.mock("../../lib/gamification", () => ({
  awardXp: vi.fn(),
}));

vi.mock("../../lib/learning-processor", () => ({
  runRecompute: vi.fn(),
}));

vi.mock("../../lib/chat/resolve-system-prompt", () => ({
  getChatLeverConfig: vi.fn(),
  resolveChatSystemPromptSections: vi.fn(),
  resolveChatPrompt: vi.fn(),
}));

function makeRes() {
  const res: any = {};
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

describe("waitlist privacy", () => {
  it("keeps public signup but does not register a public read route", async () => {
    const { default: growthRouter } = await import("../growth");
    const routes = (growthRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: layer.route.methods,
      }));

    expect(routes).toContainEqual({
      path: "/waitlist",
      methods: expect.objectContaining({ post: true }),
    });
    expect(routes).not.toContainEqual({
      path: "/waitlist",
      methods: expect.objectContaining({ get: true }),
    });
  });
});

describe("requireAdmin", () => {
  beforeEach(async () => {
    const { db } = await import("@workspace/db");
    (db.query.adminUsersTable.findFirst as ReturnType<typeof vi.fn>).mockReset();
  });

  it("returns 401 when no authenticated user is present", async () => {
    const { requireAdmin } = await import("../../middlewares/admin");
    const next = vi.fn();
    const res = makeRes();

    await requireAdmin({ session: {} } as any, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated ordinary user", async () => {
    const { db } = await import("@workspace/db");
    (db.query.adminUsersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 12,
      role: "user",
    });
    const { requireAdmin } = await import("../../middlewares/admin");
    const next = vi.fn();
    const res = makeRes();

    await requireAdmin({ session: { adminId: 12 } } as any, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.payload).toEqual({ error: "Admin access required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for an authenticated admin", async () => {
    const { db } = await import("@workspace/db");
    (db.query.adminUsersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1,
      role: "admin",
    });
    const { requireAdmin } = await import("../../middlewares/admin");
    const next = vi.fn();
    const res = makeRes();

    await requireAdmin({ session: { adminId: 1 } } as any, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

const protectedMutations = [
  { label: "create AI model config", module: "../ai-model-configs", method: "post", path: "/ai-model-configs" },
  { label: "update AI model config", module: "../ai-model-configs", method: "patch", path: "/ai-model-configs/:id" },
  { label: "delete AI model config", module: "../ai-model-configs", method: "delete", path: "/ai-model-configs/:id" },
  { label: "create AI prompt version", module: "../ai-learning", method: "post", path: "/ai-prompt-versions" },
  { label: "update AI prompt version", module: "../ai-learning", method: "patch", path: "/ai-prompt-versions/:id" },
  { label: "delete AI prompt version", module: "../ai-learning", method: "delete", path: "/ai-prompt-versions/:id" },
  { label: "create AI run evaluation", module: "../ai-learning", method: "post", path: "/ai-run-evaluations" },
  { label: "create AI training example", module: "../ai-learning", method: "post", path: "/ai-training-examples" },
  { label: "recompute AI learning", module: "../ai-learning", method: "post", path: "/ai-learning/recompute" },
  { label: "promote AI comparison", module: "../ai-learning", method: "post", path: "/ai-learning/comparisons/:id/promote" },
  { label: "revert AI comparison", module: "../ai-learning", method: "post", path: "/ai-learning/comparisons/:id/revert" },
  { label: "update AI learning config", module: "../ai-learning", method: "put", path: "/ai-learning/config" },
  { label: "update chat lever config", module: "../chat-control-plane", method: "patch", path: "/chat/lever-config" },
  { label: "create chat preset from template", module: "../chat-control-plane", method: "post", path: "/chat/lever-presets/template" },
  { label: "create chat preset", module: "../chat-control-plane", method: "post", path: "/chat/lever-presets" },
  { label: "update chat preset", module: "../chat-control-plane", method: "patch", path: "/chat/lever-presets/:id" },
  { label: "delete chat preset", module: "../chat-control-plane", method: "delete", path: "/chat/lever-presets/:id" },
  { label: "apply chat preset", module: "../chat-control-plane", method: "post", path: "/chat/lever-presets/:id/apply" },
] as const;

async function getRouteLayer(definition: (typeof protectedMutations)[number]): Promise<any> {
  const { default: router } = await import(definition.module);
  return (router as any).stack.find(
    (layer: any) => layer.route?.path === definition.path && layer.route?.methods?.[definition.method],
  );
}

describe("admin-only control-plane mutations", () => {
  beforeEach(async () => {
    const { db } = await import("@workspace/db");
    (db.query.adminUsersTable.findFirst as ReturnType<typeof vi.fn>).mockReset();
  });

  it.each(protectedMutations)("registers the shared admin guard before $label", async (definition) => {
    const { requireAdmin } = await import("../../middlewares/admin");
    const layer = await getRouteLayer(definition);

    expect(layer).toBeTruthy();
    expect(layer.route.stack[0].handle).toBe(requireAdmin);
  });

  it.each(protectedMutations)("blocks an ordinary user from $label", async (definition) => {
    const { db } = await import("@workspace/db");
    (db.query.adminUsersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 12,
      role: "user",
    });
    const { requireAdmin } = await import("../../middlewares/admin");
    const layer = await getRouteLayer(definition);
    const guard = layer.route.stack[0].handle;

    expect(guard).toBe(requireAdmin);

    const res = makeRes();
    const next = vi.fn();
    await guard({ session: { adminId: 12 } } as any, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
