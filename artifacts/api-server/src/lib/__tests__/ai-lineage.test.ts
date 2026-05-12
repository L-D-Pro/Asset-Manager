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
    expect(failureInsert.metadata.attemptErrors).toMatchObject([
      { modelName: "test/model-primary", error: "upstream timeout", category: "timeout", attemptNumber: 1 },
    ]);
  });

  it("treats content contract failures as fallback-worthy model failures", async () => {
    selectModelForTaskMock.mockResolvedValue({
      id: 11,
      provider: "openrouter",
      modelName: "test/model-primary",
      taskScope: "resume_tailoring",
      maxTokens: 1024,
      costPerInputToken: null,
      costPerOutputToken: null,
      extraConfig: {},
    });

    dbSelectMock
      .mockReturnValueOnce({
        from() {
          return {
            where() {
              return [{ fallbackModelId: 22 }];
            },
          };
        },
      })
      .mockReturnValueOnce({
        from() {
          return {
            where() {
              return [
                {
                  id: 22,
                  provider: "openrouter",
                  modelName: "test/model-fallback",
                  taskScope: "resume_tailoring",
                  maxTokens: 1024,
                  costPerInputToken: null,
                  costPerOutputToken: null,
                  extraConfig: {},
                  fallbackModelId: null,
                },
              ];
            },
          };
        },
      });

    openrouterCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: "plain readable resume" } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      });

    insertValuesMock.mockReturnValueOnce({
      returning: () => [{ id: 888 }],
    });

    const { callAI } = await import("../ai-client");

    const result = await callAI({
      taskType: "resume_tailoring",
      systemPrompt: "system",
      userPrompt: "user",
      validateContent: (content) => {
        if (!content.startsWith("{")) throw new Error("structured JSON required");
      },
    });

    expect(result.modelName).toBe("test/model-fallback");
    expect(openrouterCreate).toHaveBeenCalledTimes(2);
    const successInsert = insertValuesMock.mock.calls[0][0];
    expect(successInsert.metadata.priorFailures).toMatchObject([
      { modelName: "test/model-primary", error: "structured JSON required", category: "content_contract", attemptNumber: 1 },
    ]);
  });

  it("logs terminal failure when every fallback violates the content contract", async () => {
    openrouterCreate.mockResolvedValue({
      choices: [{ message: { content: "plain readable resume" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    insertValuesMock.mockReturnValueOnce({
      returning: () => [{ id: 889 }],
    });

    const { callAI } = await import("../ai-client");

    await expect(
      callAI({
        taskType: "resume_tailoring",
        systemPrompt: "system",
        userPrompt: "user",
        validateContent: () => {
          throw new Error("structured claim-linked JSON required");
        },
      }),
    ).rejects.toMatchObject({
      eventLogId: 889,
    });

    const failureInsert = insertValuesMock.mock.calls[0][0];
    expect(failureInsert.eventType).toBe("ai_call_failed");
    expect(failureInsert.metadata.finalError).toBe("structured claim-linked JSON required");
  });
});
