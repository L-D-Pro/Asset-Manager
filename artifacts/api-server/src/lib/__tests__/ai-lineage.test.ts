import { beforeEach, describe, expect, it, vi } from "vitest";

const openrouterCreate = vi.fn();
const selectModelForTaskMock = vi.fn();
const resolvePromptForTaskMock = vi.fn();
const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const eventLogsTableMock = { id: "id" };
const aiModelConfigsTableMock = { id: "id", isActive: "is_active", fallbackModelId: "fallback_model_id" };
const insertValuesMock = vi.fn();
const dbInsertMock = vi.fn(() => ({ values: insertValuesMock }));
const dbSelectMock = vi.fn();

vi.mock("@workspace/integrations-openrouter-ai", () => ({
  openrouter: {
    chat: {
      completions: {
        create: openrouterCreate,
      },
    },
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    insert: dbInsertMock,
    select: dbSelectMock,
  },
  eventLogsTable: eventLogsTableMock,
  aiModelConfigsTable: aiModelConfigsTableMock,
}));

vi.mock("../model-router", () => ({
  selectModelForTask: selectModelForTaskMock,
}));

vi.mock("../prompt-router", () => ({
  resolvePromptForTask: resolvePromptForTaskMock,
}));

vi.mock("../logger", () => ({
  logger: loggerMock,
}));

describe("callAI lineage propagation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    resolvePromptForTaskMock.mockResolvedValue({
      systemPrompt: "resolved system",
      userPrompt: "resolved user",
      promptVersionId: 42,
      promptLabel: "resume-tailor-v42",
    });

    selectModelForTaskMock.mockResolvedValue({
      id: 11,
      provider: "openrouter",
      modelName: "test/model-primary",
      taskScope: "resume_tailoring",
      maxTokens: 1024,
      costPerInputToken: "0.001",
      costPerOutputToken: "0.002",
      extraConfig: {},
    });

    dbSelectMock.mockReturnValue({
      from() {
        return {
          where() {
            return [{ fallbackModelId: null }];
          },
        };
      },
    });
  });

  it("mints one canonical runId, logs success with it, and returns the root eventLogId", async () => {
    openrouterCreate.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 12, completion_tokens: 34 },
    });

    insertValuesMock.mockReturnValueOnce({
      returning: () => [{ id: 501 }],
    });

    const { callAI } = await import("../ai-client");

    const result = await callAI({
      taskType: "resume_tailoring",
      systemPrompt: "system",
      userPrompt: "user",
      jobId: 99,
    });

    expect(result.runId).toMatch(/^run_/i);
    expect(result.eventLogId).toBe(501);

    expect(dbInsertMock).toHaveBeenCalledWith(eventLogsTableMock);
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    const successInsert = insertValuesMock.mock.calls[0][0];
    expect(successInsert.runId).toBe(result.runId);
    expect(successInsert.eventType).toBe("ai_call");
    expect(successInsert.metadata.runId).toBe(result.runId);
    expect(successInsert.metadata.priorFailures).toEqual([]);
  });

  it("reuses a caller-supplied runId across fallback failures and terminal failure logging", async () => {
    openrouterCreate.mockRejectedValue(new Error("upstream timeout"));

    insertValuesMock.mockReturnValueOnce({
      returning: () => [{ id: 777 }],
    });

    const { callAI } = await import("../ai-client");

    const suppliedRunId = "run_20260417t000000z_supplied123456";

    await expect(
      callAI({
        taskType: "resume_tailoring",
        systemPrompt: "system",
        userPrompt: "user",
        jobId: 99,
        runId: suppliedRunId,
      }),
    ).rejects.toMatchObject({
      runId: suppliedRunId,
      eventLogId: 777,
    });

    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    const failureInsert = insertValuesMock.mock.calls[0][0];
    expect(failureInsert.runId).toBe(suppliedRunId);
    expect(failureInsert.eventType).toBe("ai_call_failed");
    expect(failureInsert.metadata.runId).toBe(suppliedRunId);
    expect(failureInsert.metadata.attemptErrors).toEqual([
      { modelName: "test/model-primary", error: "upstream timeout" },
    ]);
  });
});
