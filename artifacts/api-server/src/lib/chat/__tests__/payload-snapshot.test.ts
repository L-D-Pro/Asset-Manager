import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  messagesTable,
  eventLogsTableSym,
  selectQueue,
  dbSelect,
} = vi.hoisted(() => {
  const hoistedSelectQueue: unknown[][] = [];

  function makeSelectChain(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ limit, orderBy });
    const from = vi.fn().mockReturnValue({ where, orderBy, limit });
    return { from };
  }

  const hoistedDbSelect = vi.fn().mockImplementation(() => {
    const rows = hoistedSelectQueue.shift() ?? [];
    return makeSelectChain(rows);
  });

  return {
    messagesTable: Symbol("messages"),
    eventLogsTableSym: Symbol("event_logs"),
    selectQueue: hoistedSelectQueue,
    dbSelect: hoistedDbSelect,
  };
});

function queueSelect(rows: unknown[]) {
  selectQueue.push(rows);
}

vi.mock("@workspace/db", () => ({
  db: { select: dbSelect },
  messages: messagesTable,
  eventLogsTable: eventLogsTableSym,
}));

import {
  asPreviewRebuild,
  asSentSnapshot,
  loadStoredPayloadSnapshotForAssistant,
  PREVIEW_REBUILD_WARNING,
} from "../payload-snapshot";
import type { FinalChatPayloadInspect } from "../final-payload-builder";

function makePayload(): FinalChatPayloadInspect {
  return {
    payloadSource: "preview_rebuild",
    isExactModelPayload: false,
    messages: [
      { role: "system", content: "system" },
      { role: "user", content: "prior user" },
      { role: "assistant", content: "prior assistant" },
      { role: "user", content: "current user" },
    ],
    systemPrompt: "system",
    sections: [{ lever: "identity", label: "Identity", content: "system" }],
    parsedJdBlock: null,
    routingDecision: {
      selectedSlugs: ["Resume-Tailoring-Core"],
      confidence: 0.9,
      reason: "explicit",
      candidates: [],
      llmUsed: false,
      budgetTrimmed: false,
      skillPromptTokens: 0,
    },
    routingMode: "explicit",
    providerRequest: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    metadata: {
      selectedSkillCount: 1,
      historyMessageCount: 3,
      fullSkillCatalogPresent: false,
      parsedJdPresent: false,
      parsedJdSectioned: false,
      bestPracticesEnabled: false,
      finalMessageRole: "user",
      finalMessageIsUser: true,
      currentUserMessageIndex: 3,
      historyIsChronological: true,
      warnings: [],
    },
  };
}

describe("payload snapshot helpers", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    dbSelect.mockClear();
  });

  it("promotes a rebuilt payload to an exact sent snapshot", () => {
    const payload = makePayload();

    const snapshot = asSentSnapshot({
      payload,
      providerRequest: { provider: "openrouter", model: "anthropic/claude-3.5-haiku", maxTokens: 2048, stream: true },
      createdAt: "2026-06-01T20:00:00.000Z",
    });

    expect(snapshot.payloadSource).toBe("sent_snapshot");
    expect(snapshot.isExactModelPayload).toBe(true);
    expect(snapshot.providerRequest?.model).toBe("anthropic/claude-3.5-haiku");
  });

  it("adds the fallback warning to rebuilt payloads", () => {
    const payload = makePayload();

    const rebuilt = asPreviewRebuild(payload, PREVIEW_REBUILD_WARNING);

    expect(rebuilt.payloadSource).toBe("preview_rebuild");
    expect(rebuilt.isExactModelPayload).toBe(false);
    expect(rebuilt.metadata.warnings).toContain(PREVIEW_REBUILD_WARNING);
  });

  it("loads a stored snapshot for the matching assistant response", async () => {
    const sentSnapshot = asSentSnapshot({
      payload: makePayload(),
      providerRequest: { provider: "openrouter", model: "anthropic/claude-3.5-haiku", maxTokens: 2048, stream: true },
      createdAt: "2026-06-01T20:00:00.000Z",
    });

    queueSelect([{ id: 77, runId: "run_123" }]);
    queueSelect([{ metadata: { finalPayloadSnapshot: sentSnapshot } }]);

    const result = await loadStoredPayloadSnapshotForAssistant({
      userId: 1,
      assistantMessageId: 77,
    });

    expect(result?.payloadSource).toBe("sent_snapshot");
    expect(result?.messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(result?.messages.at(-1)?.role).toBe("user");
  });

  it("returns null when no stored snapshot exists", async () => {
    queueSelect([{ id: 77, runId: "run_123" }]);
    queueSelect([{ metadata: {} }]);

    const result = await loadStoredPayloadSnapshotForAssistant({
      userId: 1,
      assistantMessageId: 77,
    });

    expect(result).toBeNull();
  });
});
