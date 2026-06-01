/**
 * Tests for streamChatCompletion — focused on fallback behavior correctness.
 *
 * Key behaviors under test:
 * 1. When primary fails mid-stream (partial tokens emitted), the fallback starts
 *    with a clean slate — the DB record contains only fallback tokens.
 * 2. A non-retryable 4xx from the primary does not trigger a fallback attempt.
 * 3. Stream errors are logged (not silently swallowed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Table identity stubs ─────────────────────────────────────────────────────
const conversationsTable = Symbol("conversations");
const messagesTable = Symbol("messages");
const eventLogsTableSym = Symbol("eventLogsTable");
const chatRoutingDecisionsSym = Symbol("chatRoutingDecisions");
const aiModelConfigsSym = Symbol("aiModelConfigs");

// ── DB mock ──────────────────────────────────────────────────────────────────
const selectQueue: unknown[][] = [];
function queueSelect(rows: unknown[]) {
  selectQueue.push(rows);
}

function makeSelectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ limit, orderBy });
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

const dbSelect = vi.fn().mockImplementation(() => {
  const rows = selectQueue.shift() ?? [];
  return makeSelectChain(rows);
});

type InsertCapture = { table: unknown; values: unknown };
const insertCaptures: InsertCapture[] = [];
let nextInsertId = 1;

const dbInsert = vi.fn().mockImplementation((table: unknown) => ({
  values: vi.fn().mockImplementation((vals: unknown) => {
    const id = nextInsertId++;
    // Deep-clone via JSON so captured values reflect state at call time, not later mutations.
    insertCaptures.push({ table, values: JSON.parse(JSON.stringify(vals)) });
    const row = { id, ...(vals as Record<string, unknown>) };
    const returning = vi.fn().mockResolvedValue([row]);
    // Make the values() result directly awaitable (for inserts without .returning())
    return Object.assign(Promise.resolve([row]), { returning });
  }),
}));

const dbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
});

vi.mock("@workspace/db", () => ({
  db: { select: dbSelect, insert: dbInsert, update: dbUpdate },
  conversations: conversationsTable,
  messages: messagesTable,
  eventLogsTable: eventLogsTableSym,
  chatRoutingDecisionsTable: chatRoutingDecisionsSym,
  aiModelConfigsTable: aiModelConfigsSym,
  // type-only re-exports — not used at runtime in these tests
}));

// ── Logger mock ──────────────────────────────────────────────────────────────
const warnMock = vi.fn();
const errorMock = vi.fn();
vi.mock("../../logger", () => ({
  logger: { info: vi.fn(), warn: warnMock, error: errorMock },
}));

// ── Lineage mock ─────────────────────────────────────────────────────────────
vi.mock("../../lineage", () => ({
  mintRunId: () => "run_test_fixed",
}));

// ── Model router mock ────────────────────────────────────────────────────────
vi.mock("../../model-router", () => ({
  selectModelForTask: vi.fn().mockResolvedValue(null),
}));

// ── resolve-system-prompt mock ───────────────────────────────────────────────
vi.mock("../resolve-system-prompt", () => ({
  getChatLeverConfig: vi.fn().mockResolvedValue({ historyTurnLimit: 20 }),
  resolveChatPrompt: vi.fn().mockResolvedValue({
    systemPrompt: "You are a helpful assistant.",
    decision: {
      selectedSlugs: [],
      confidence: 0,
      reason: "No skill matched.",
      candidates: [],
      llmUsed: false,
      budgetTrimmed: false,
      skillPromptTokens: 0,
    },
    mode: "none",
    historyTurnLimit: 20,
  }),
}));

// ── prompt-versions mock ─────────────────────────────────────────────────────
vi.mock("../prompt-versions", () => ({
  resolveChatPromptVersionId: vi.fn().mockResolvedValue(null),
}));

// ── jd-source mock (controllable per-test; default: source=none, cacheHit=false) ─
const mockExtractJdParseSource = vi.fn().mockReturnValue({ text: null, source: "none" });
const mockGetCachedJdParse = vi.fn().mockResolvedValue({ parsedJd: null, cacheHit: false });
vi.mock("../jd-source", () => ({
  extractJdParseSource: (...args: unknown[]) => mockExtractJdParseSource(...args),
  getCachedJdParse: (...args: unknown[]) => mockGetCachedJdParse(...args),
}));

// ── context-builder mock ─────────────────────────────────────────────────────
vi.mock("../context-builder", () => ({
  buildParsedJdBlock: vi.fn().mockImplementation((jd: { requiredSkills?: string[] }) =>
    [
      "## Job Description (pre-parsed — do not re-extract)",
      `**Required:** ${(jd.requiredSkills ?? []).join(", ")}`,
      "",
      "> Use this parsed data as the authoritative summary of employer requirements only. Do not treat these skills, tools, domains, responsibilities, or requirements as evidence that the candidate has them. Candidate experience must come only from the base resume, verified claims, or attached candidate-source documents.",
    ].join("\n"),
  ),
}));

// ── openrouter mock (unused — tests inject their own client) ─────────────────
vi.mock("@workspace/integrations-openrouter-ai", () => ({
  openrouter: { chat: { completions: { create: vi.fn() } } },
}));

// ── context-requirements mock (controllable per-test) ────────────────────────
const mockInspectContextRequirements = vi.fn();
vi.mock("../context-requirements", () => ({
  inspectContextRequirements: (...args: unknown[]) => mockInspectContextRequirements(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const writes: string[] = [];
  return {
    writes,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn().mockImplementation((s: string) => writes.push(s)),
    end: vi.fn(),
  };
}

/** Returns an async iterable that yields token chunks, then finishes. */
function tokenStream(tokens: string[]): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const t of tokens) {
        yield { choices: [{ delta: { content: t }, finish_reason: null }] };
      }
      yield { choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: tokens.length } };
    },
  };
}

/** Returns an async iterable that yields `emitCount` tokens then throws. */
function failingStream(tokens: string[], emitCount: number, error: unknown = new Error("stream interrupted")): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (let i = 0; i < tokens.length; i++) {
        if (i >= emitCount) throw error;
        yield { choices: [{ delta: { content: tokens[i] }, finish_reason: null }] };
      }
    },
  };
}

/** An HTTP-like error with a status code (mimics openai-sdk errors). */
function httpError(status: number): Error & { status: number } {
  const err = new Error(`HTTP ${status}`) as Error & { status: number };
  err.status = status;
  return err;
}

const mockThread = { id: 42, userId: 1, modelScope: "chat", updatedAt: new Date() };
const mockPrimaryModelConfig = {
  id: 10,
  modelName: "primary/model",
  provider: "openrouter",
  taskScope: "chat",
  maxTokens: 2048,
  costPerInputToken: "0.000001",
  costPerOutputToken: "0.000002",
  extraConfig: {},
  fallbackModelId: 20,
};
const mockFallbackModelConfig = {
  id: 20,
  modelName: "fallback/model",
  provider: "openrouter",
  taskScope: "chat",
  maxTokens: 2048,
  costPerInputToken: "0.000001",
  costPerOutputToken: "0.000002",
  extraConfig: {},
  fallbackModelId: null,
};

function queueStandardSelects() {
  queueSelect([mockThread]);       // ownership check
  queueSelect([mockPrimaryModelConfig]); // resolveModel (modelConfigId provided)
  queueSelect([]);                 // history (empty)
}

function queueFallbackSelects() {
  queueSelect([mockPrimaryModelConfig]); // primary config (to get fallbackModelId)
  queueSelect([mockFallbackModelConfig]); // fallback model row
}

beforeEach(() => {
  selectQueue.length = 0;
  insertCaptures.length = 0;
  nextInsertId = 1;
  dbSelect.mockClear();
  dbInsert.mockClear();
  dbUpdate.mockClear();
  warnMock.mockClear();
  errorMock.mockClear();
  // Default: context requirements not blocking (pass-through for existing tests).
  mockInspectContextRequirements.mockReturnValue({
    hasBaseResume: true,
    hasJobContext: true,
    hasClaims: false,
    warnings: [],
    blocking: false,
  });
  // Default: no JD source found (existing tests don't pass jdParseEnabled).
  mockExtractJdParseSource.mockClear();
  mockGetCachedJdParse.mockClear();
  mockExtractJdParseSource.mockReturnValue({ text: null, source: "none" });
  mockGetCachedJdParse.mockResolvedValue({ parsedJd: null, cacheHit: false });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("streamChatCompletion — fallback state isolation", () => {
  it("DB assistant message contains ONLY fallback tokens when primary fails mid-stream", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    const primaryTokens = ["Hello", " world"];
    const fallbackTokens = ["Fallback", " response"];

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(primaryTokens, 1); // emits "Hello" then throws
            return tokenStream(fallbackTokens);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "test message", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    // The assistant DB insert is the second messages insert (first is user turn).
    const messageInserts = insertCaptures.filter((c) => c.table === messagesTable);
    expect(messageInserts).toHaveLength(2);
    const assistantInsert = messageInserts[1]!.values as { role: string; content: string };

    expect(assistantInsert.role).toBe("assistant");
    // MUST be only fallback tokens — not "HelloFallback response"
    expect(assistantInsert.content).toBe("Fallback response");
  });

  it("emits stream-reset SSE event when primary fails after emitting tokens", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(["A", "B"], 1);
            return tokenStream(["ok"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    const allWritten = res.writes.join("");
    expect(allWritten).toMatch(/stream-reset/);
  });

  it("logs a warning that includes the error object when primary stream throws", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    const streamError = new Error("network interrupted");
    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(["X"], 0, streamError);
            return tokenStream(["ok"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    // logger.warn must include the actual error — not silently swallowed in bare catch {}
    const warnCalls = warnMock.mock.calls;
    const hasErrField = warnCalls.some(
      (args) => args[0] && typeof args[0] === "object" && "err" in args[0],
    );
    expect(hasErrField).toBe(true);
  });
});

describe("streamChatCompletion — 4xx non-retryable skips fallback", () => {
  it("does NOT attempt the fallback when primary returns a non-retryable 4xx (400)", async () => {
    // Queue fallback selects so the fallback IS available — without 4xx detection
    // the current code would attempt the fallback (calling create twice).
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) throw httpError(400);
            // Fallback would succeed if it were attempted
            return tokenStream(["fallback ok"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    // Client create should be called exactly once — 400 must skip fallback
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    // An error SSE event must be emitted
    const allWritten = res.writes.join("");
    expect(allWritten).toMatch(/event: error/);
    expect(res.end).toHaveBeenCalled();
  });

  it("DOES attempt fallback for 429 (rate limit — retryable)", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) throw httpError(429);
            return tokenStream(["ok"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    // Two calls: primary (429) + fallback (success)
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("DOES attempt fallback for 408 (timeout — retryable)", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) throw httpError(408);
            return tokenStream(["ok"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
  });
});

describe("streamChatCompletion — event log metadata includes chatTimings", () => {
  it("successful chat event log includes metadata.chatTimings with expected fields", async () => {
    queueSelect([mockThread]);
    queueSelect([mockPrimaryModelConfig]);
    queueSelect([{ role: "user", content: "hi" }]);

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(tokenStream(["hi"])),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hello", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    expect(eventLogCapture).toBeDefined();

    const metadata = (eventLogCapture!.values as { metadata: Record<string, unknown> }).metadata;
    const chatTimings = metadata.chatTimings as Record<string, unknown>;

    expect(chatTimings).toBeDefined();
    expect(typeof chatTimings).toBe("object");

    const expectedKeys = [
      "ownershipMs",
      "persistUserTurnMs",
      "resolveModelMs",
      "loadLeverConfigMs",
      "loadHistoryMs",
      "jdParseMs",
      "resolvePromptMs",
      "resolvePromptVersionMs",
      "timeToFirstTokenMs",
      "streamDurationMs",
      "persistAssistantMs",
      "persistRoutingDecisionMs",
      "persistEventLogMs",
      "totalMs",
    ];

    for (const key of expectedKeys) {
      expect(chatTimings).toHaveProperty(key);
      expect(typeof chatTimings[key]).toBe("number");
      expect(chatTimings[key] as number).toBeGreaterThanOrEqual(0);
    }

    expect(metadata.attachmentCount).toBe(0);
    expect(typeof metadata.historyTurnCount).toBe("number");
    expect(metadata.finalPayloadSnapshot).toBeDefined();

    const snapshot = metadata.finalPayloadSnapshot as {
      payloadSource: string;
      isExactModelPayload: boolean;
      messages: Array<{ role: string; content: string }>;
      providerRequest: { provider: string; model: string; stream: boolean; maxTokens: number };
      metadata: { finalMessageIsUser: boolean; parsedJdPresent: boolean; parsedJdSectioned: boolean };
    };
    expect(snapshot.payloadSource).toBe("sent_snapshot");
    expect(snapshot.isExactModelPayload).toBe(true);
    expect(snapshot.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(snapshot.messages.at(-1)?.role).toBe("user");
    expect(snapshot.messages.some((m) => m.content.includes("Great tailored resume!"))).toBe(false);
    expect(snapshot.providerRequest).toEqual({
      provider: "openrouter",
      model: "primary/model",
      stream: true,
      maxTokens: 2048,
    });
    expect(snapshot.metadata.finalMessageIsUser).toBe(true);
    expect(snapshot.metadata.parsedJdPresent).toBe(false);
    expect(snapshot.metadata.parsedJdSectioned).toBe(false);
  });

  it("stores parsed JD inside the sent snapshot when live generation used it", async () => {
    queueSelect([mockThread]);
    queueSelect([mockPrimaryModelConfig]);
    queueSelect([{ role: "user", content: "Tailor my resume for this role" }]);

    mockExtractJdParseSource.mockReturnValue({
      text: "JD text",
      source: "job_attachment",
    });
    mockGetCachedJdParse.mockResolvedValue({
      parsedJd: {
        requiredSkills: ["TypeScript", "React"],
        niceToHaveSkills: [],
        keywords: [],
        senioritySignal: null,
        location: null,
        remoteType: null,
      },
      cacheHit: false,
    });

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(tokenStream(["tailored output"])),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: {
        content: "Tailor my resume for this role",
        attachments: [{ kind: "job", snapshot: { title: "SE", jdText: "JD text" } }],
      },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
      jdParseEnabled: true,
    });

    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    const metadata = (eventLogCapture!.values as { metadata: Record<string, unknown> }).metadata;
    const snapshot = metadata.finalPayloadSnapshot as {
      systemPrompt: string;
      sections: Array<{ lever: string; content: string }>;
      metadata: { parsedJdPresent: boolean; parsedJdSectioned: boolean };
    };

    expect(snapshot.systemPrompt).toContain("authoritative summary of employer requirements only");
    expect(snapshot.sections.some((section) => section.lever === "parsed_jd")).toBe(true);
    expect(snapshot.metadata.parsedJdPresent).toBe(true);
    expect(snapshot.metadata.parsedJdSectioned).toBe(true);
  });

  it("failed chat event log (non-retryable 4xx) includes partial chatTimings", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            throw httpError(400);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    expect(eventLogCapture).toBeDefined();

    const metadata = (eventLogCapture!.values as { metadata: Record<string, unknown> }).metadata;
    const chatTimings = metadata.chatTimings as Record<string, unknown>;

    expect(chatTimings).toBeDefined();
    expect(typeof chatTimings).toBe("object");
    expect(chatTimings).toHaveProperty("ownershipMs");
    expect(typeof chatTimings.totalMs).toBe("number");
    expect(chatTimings.totalMs as number).toBeGreaterThanOrEqual(0);
  });
});

describe("streamChatCompletion — context requirements guard", () => {
  it("blocks and sends context-warning SSE when tailor slug selected but no base_resume attached", async () => {
    queueStandardSelects();

    // Override context requirements to simulate a blocking condition.
    mockInspectContextRequirements.mockReturnValue({
      hasBaseResume: false,
      hasJobContext: true,
      hasClaims: false,
      warnings: ["Base resume is required for resume tailoring. Please attach or select your base resume."],
      blocking: true,
    });

    // The mock client should NOT be called — we block before any AI call.
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "Tailor my resume for this job.", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    // AI client must NOT be called.
    expect(mockClient.chat.completions.create).not.toHaveBeenCalled();

    const allWritten = res.writes.join("");

    // A context-warning SSE event must be emitted.
    expect(allWritten).toMatch(/event: context-warning/);
    expect(allWritten).toMatch(/blocking.*true|true.*blocking/);

    // A done event must be emitted after the context-warning.
    expect(allWritten).toMatch(/event: done/);

    // The stream must end.
    expect(res.end).toHaveBeenCalled();

    // An assistant message must be persisted with the warning content.
    const messageInserts = insertCaptures.filter((c) => c.table === messagesTable);
    // user turn + blocked assistant turn = 2
    expect(messageInserts).toHaveLength(2);
    const assistantInsert = messageInserts[1]!.values as { role: string; content: string };
    expect(assistantInsert.role).toBe("assistant");
    expect(assistantInsert.content).toMatch(/[Bb]ase resume/);

    // An event log with ai_call_skipped must be inserted.
    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    expect(eventLogCapture).toBeDefined();
    const eventLogValues = eventLogCapture!.values as { eventType: string; metadata: Record<string, unknown> };
    expect(eventLogValues.eventType).toBe("ai_call_skipped");
    expect(eventLogValues.metadata.reason).toBe("context_requirements_not_met");
  });

  it("does NOT block when tailor slug selected and base_resume + job both attached", async () => {
    queueStandardSelects();

    // Default mock is non-blocking (set in beforeEach).
    // Explicitly confirm it for clarity.
    mockInspectContextRequirements.mockReturnValue({
      hasBaseResume: true,
      hasJobContext: true,
      hasClaims: false,
      warnings: [],
      blocking: false,
    });

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(tokenStream(["Great tailored resume!"])),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: {
        content: "Tailor my resume for this job.",
        attachments: [
          { kind: "base_resume", snapshot: { content: "My resume" } },
          { kind: "job", refId: 1, snapshot: { title: "Software Engineer" } },
        ],
      },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    // AI client SHOULD be called — context requirements are satisfied.
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);

    const allWritten = res.writes.join("");
    // No context-warning event should appear.
    expect(allWritten).not.toMatch(/event: context-warning/);
    // Normal done event should appear.
    expect(allWritten).toMatch(/event: done/);
  });
});

describe("streamChatCompletion — StreamingFallbackPolicy", () => {
  it("reset_and_fallback (default): primary fails after partial tokens → stream-reset + fallback succeeds, event log has policy metadata", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(["Hello", " world"], 1); // emits "Hello" then throws
            return tokenStream(["Fallback"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
      streamingFallbackPolicy: "reset_and_fallback",
    });

    // Fallback was called
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);

    // stream-reset was emitted
    const allWritten = res.writes.join("");
    expect(allWritten).toMatch(/stream-reset/);

    // Success event log has policy metadata
    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    expect(eventLogCapture).toBeDefined();
    const metadata = (eventLogCapture!.values as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.streamingFallbackPolicy).toBe("reset_and_fallback");
    expect(metadata.primaryFailed).toBe(true);
    expect(metadata.partialTokensBeforeReset).toBeGreaterThan(0);
    expect(metadata.usedFallback).toBe(true);
    expect(metadata.fallbackModel).toBe("fallback/model");
  });

  it("fallback_before_first_token_only: primary fails BEFORE tokens → fallback succeeds", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(["X"], 0); // throws immediately, 0 tokens emitted
            return tokenStream(["ok"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
      streamingFallbackPolicy: "fallback_before_first_token_only",
    });

    // Fallback is called (primary failed before any tokens)
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);

    const allWritten = res.writes.join("");
    expect(allWritten).toMatch(/event: done/);
    expect(allWritten).not.toMatch(/event: error/);
  });

  it("fallback_before_first_token_only: primary fails AFTER tokens → NO fallback, error SSE emitted", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(["Hello", " world"], 1); // emits "Hello" then throws
            return tokenStream(["should not be called"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
      streamingFallbackPolicy: "fallback_before_first_token_only",
    });

    // Only primary is called — no fallback attempt
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);

    const allWritten = res.writes.join("");
    expect(allWritten).toMatch(/event: error/);
    expect(allWritten).not.toMatch(/event: done/);

    // Event log must be ai_call_failed with policy metadata
    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    expect(eventLogCapture).toBeDefined();
    const evtValues = eventLogCapture!.values as { eventType: string; metadata: Record<string, unknown> };
    expect(evtValues.eventType).toBe("ai_call_failed");
    expect(evtValues.metadata.streamingFallbackPolicy).toBe("fallback_before_first_token_only");
    expect(evtValues.metadata.primaryFailed).toBe(true);
    expect(evtValues.metadata.partialTokensBeforeReset).toBeGreaterThan(0);
    expect(evtValues.metadata.usedFallback).toBe(false);
  });

  it("no_fallback_after_partial: primary fails AFTER tokens → NO fallback, error SSE emitted", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(["Partial", " output"], 1); // emits "Partial" then throws
            return tokenStream(["should not be called"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
      streamingFallbackPolicy: "no_fallback_after_partial",
    });

    // Only primary is called — no fallback attempt
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);

    const allWritten = res.writes.join("");
    expect(allWritten).toMatch(/event: error/);
    expect(allWritten).not.toMatch(/event: done/);

    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    expect(eventLogCapture).toBeDefined();
    const evtValues = eventLogCapture!.values as { eventType: string; metadata: Record<string, unknown> };
    expect(evtValues.eventType).toBe("ai_call_failed");
    expect(evtValues.metadata.streamingFallbackPolicy).toBe("no_fallback_after_partial");
    expect(evtValues.metadata.primaryFailed).toBe(true);
    expect(evtValues.metadata.partialTokensBeforeReset).toBeGreaterThan(0);
    expect(evtValues.metadata.usedFallback).toBe(false);
  });

  it("no_fallback_after_partial: primary fails BEFORE any tokens → fallback still attempted", async () => {
    queueStandardSelects();
    queueFallbackSelects();

    let callCount = 0;
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) return failingStream(["X"], 0); // throws before any tokens
            return tokenStream(["ok"]);
          }),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
      streamingFallbackPolicy: "no_fallback_after_partial",
    });

    // Fallback is attempted because partialTokensBeforeReset === 0
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);

    const allWritten = res.writes.join("");
    expect(allWritten).toMatch(/event: done/);
    expect(allWritten).not.toMatch(/event: error/);
  });

  it("success path event log includes streamingFallbackPolicy, primaryFailed: false, usedFallback: false when no failure", async () => {
    queueStandardSelects();

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(tokenStream(["hello"])),
        },
      },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "hi", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    const eventLogCapture = insertCaptures.find((c) => c.table === eventLogsTableSym);
    expect(eventLogCapture).toBeDefined();
    const metadata = (eventLogCapture!.values as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.streamingFallbackPolicy).toBe("reset_and_fallback");
    expect(metadata.primaryFailed).toBe(false);
    expect(metadata.partialTokensBeforeReset).toBe(0);
    expect(metadata.usedFallback).toBe(false);
    expect(metadata.fallbackModel).toBeNull();
  });
});

describe("streamChatCompletion — jdParseEnabled=false skips JD source extraction", () => {
  it("does not call extractJdParseSource or getCachedJdParse when jdParseEnabled is false", async () => {
    queueStandardSelects();

    const mockClient = {
      chat: { completions: { create: vi.fn().mockResolvedValue(tokenStream(["ok"])) } },
    };

    const { streamChatCompletion } = await import("../stream-openrouter");
    const res = makeRes();

    await streamChatCompletion({
      conversationId: 42,
      userId: 1,
      userMessage: { content: "tailor my resume", attachments: [] },
      res: res as never,
      modelConfigId: 10,
      jdParseEnabled: false,
      client: mockClient as never,
      runIdOverride: "run_test_fixed",
    });

    expect(mockExtractJdParseSource).not.toHaveBeenCalled();
    expect(mockGetCachedJdParse).not.toHaveBeenCalled();

    const allWritten = res.writes.join("");
    expect(allWritten).not.toMatch(/event: jd-parsing/);
    expect(allWritten).toMatch(/event: done/);
  });
});
