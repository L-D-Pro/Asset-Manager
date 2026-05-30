/**
 * Tests for chat-prompt-cache.ts — version-aware LRU cache for the prompt bundle.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted stubs ────────────────────────────────────────────────────────────
// vi.mock factories are hoisted to the top of the file — so any mock that needs
// to reference variables must use vi.hoisted().

const { dbSelectMock, selectQueueRef } = vi.hoisted(() => {
  const queue: unknown[][] = [];

  function makeChain(rows: unknown[]) {
    // Make orderBy directly awaitable (resolves to rows) AND support .limit()
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = Object.assign(vi.fn().mockResolvedValue(rows), { limit });
    const where = vi.fn().mockReturnValue({ limit, orderBy });
    const from = vi.fn().mockReturnValue({ where, limit, orderBy });
    return { from };
  }

  const selectFn = vi.fn().mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return makeChain(rows);
  });

  return { dbSelectMock: selectFn, selectQueueRef: queue };
});

const { loadBpMock, formatBpMock } = vi.hoisted(() => ({
  loadBpMock: vi.fn(),
  formatBpMock: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: { select: dbSelectMock },
  aiChatLeverConfigTable: Symbol("aiChatLeverConfig"),
  aiPromptVersionsTable: Symbol("aiPromptVersions"),
}));

vi.mock("../../best-practices", () => ({
  loadOrCreateBestPractices: loadBpMock,
  formatBestPracticesForPrompt: formatBpMock,
}));

vi.mock("../system-prompt", () => ({
  IDENTITY_BLOCK: "You are a helpful assistant.",
}));

// ── SUT import (after mocks) ─────────────────────────────────────────────────
import {
  getCachedPromptBundle,
  resetPromptBundleCacheForTesting,
} from "../chat-prompt-cache";

// ── Helpers ──────────────────────────────────────────────────────────────────

function queueSelect(rows: unknown[]) {
  selectQueueRef.push(rows);
}

function makeConfigRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    identityText: "You are a helpful assistant.",
    skillsEnabled: true,
    bestPracticesEnabled: true,
    skillRoutingMode: "auto",
    skillTokenBudget: 1500,
    maxSelectedSkills: 1,
    autoThreshold: 0.3,
    triggerWeight: 0.3,
    negativeTriggerWeight: 0.5,
    ambiguousGap: 0.15,
    llmConfidenceThreshold: 0.5,
    coverBoost: 0.3,
    boostTailorPlusJob: 0.4,
    boostResumePlusJob: 0.2,
    boostAuditTailoredJob: 0.4,
    boostAuditTailoredOnly: 0.2,
    historyTurnLimit: 20,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeSkillRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    label: "resume-tailor",
    roleLabel: "Resume Expert",
    systemPrompt: "You tailor resumes.",
    taskScope: "chat",
    isActive: true,
    version: 1,
    metadata: {
      routerDescription: "Tailor resumes",
      triggerExamples: ["tailor my resume"],
      negativeTriggers: [],
      taskTypes: ["chat"],
      priority: 50,
      status: "active",
    },
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeBestPractices(overrides: Record<string, unknown> = {}) {
  return {
    domain: "general",
    title: "Best Practices",
    items: [{ description: "Be concise", source: "hardcoded" }],
    hardcodedGuards: {},
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getCachedPromptBundle", () => {
  beforeEach(() => {
    resetPromptBundleCacheForTesting();
    vi.clearAllMocks();
    // Drain any leftover queue entries
    selectQueueRef.length = 0;

    // Default best-practices setup
    loadBpMock.mockResolvedValue(makeBestPractices());
    formatBpMock.mockReturnValue("\n\nQUALITY STANDARDS...");
  });

  it("cache miss on first call: loads from DB, builds bundle, returns it", async () => {
    const configRow = makeConfigRow();
    const skillRow = makeSkillRow();

    queueSelect([configRow]); // configRows
    queueSelect([skillRow]);  // skillRows

    const bundle = await getCachedPromptBundle();

    expect(dbSelectMock).toHaveBeenCalledTimes(2);
    expect(loadBpMock).toHaveBeenCalledTimes(1);

    expect(bundle.config).toEqual(configRow);
    expect(bundle.allSkills).toHaveLength(1);
    expect(bundle.allSkills[0]?.slug).toBe("resume-tailor");
    expect(bundle.allSkills[0]?.name).toBe("Resume Expert");
    expect(bundle.versionKey).toBeTruthy();
    expect(bundle.versionKey.length).toBe(32);
  });

  it("cache hit on second call with same DB state: returns same bundle object", async () => {
    const configRow = makeConfigRow();
    const skillRow = makeSkillRow();

    // First call
    queueSelect([configRow]);
    queueSelect([skillRow]);
    const first = await getCachedPromptBundle();

    // Second call with same data — still needs to run the 3 parallel loads to
    // compute the version key, then finds the cached bundle.
    queueSelect([configRow]);
    queueSelect([skillRow]);
    const second = await getCachedPromptBundle();

    // Same bundle reference — cache hit
    expect(second).toBe(first);
  });

  it("version key changes when skill version changes: two calls produce different version keys", async () => {
    const configRow = makeConfigRow();

    // First call: skill version 1
    queueSelect([configRow]);
    queueSelect([makeSkillRow({ version: 1 })]);
    const first = await getCachedPromptBundle();

    // Second call: skill version 2 (simulates a CP edit)
    queueSelect([configRow]);
    queueSelect([makeSkillRow({ version: 2 })]);
    const second = await getCachedPromptBundle();

    expect(first.versionKey).not.toBe(second.versionKey);
    expect(second).not.toBe(first);
  });

  it("resetPromptBundleCacheForTesting clears cache: first miss, reset, then another miss", async () => {
    const configRow = makeConfigRow();
    const skillRow = makeSkillRow();

    // First call
    queueSelect([configRow]);
    queueSelect([skillRow]);
    const first = await getCachedPromptBundle();

    expect(dbSelectMock).toHaveBeenCalledTimes(2);

    // Reset
    resetPromptBundleCacheForTesting();

    // Second call after reset — DB is queried again
    queueSelect([configRow]);
    queueSelect([skillRow]);
    const second = await getCachedPromptBundle();

    expect(dbSelectMock).toHaveBeenCalledTimes(4);
    // Different object (new bundle built after reset)
    expect(second).not.toBe(first);
    // Same version key (same underlying data)
    expect(second.versionKey).toBe(first.versionKey);
  });

  it("bestPracticesEnabled=false → bestPracticesText is empty string", async () => {
    const configRow = makeConfigRow({ bestPracticesEnabled: false });

    queueSelect([configRow]);
    queueSelect([makeSkillRow()]);

    const bundle = await getCachedPromptBundle();

    expect(bundle.bestPracticesText).toBe("");
    // formatBestPracticesForPrompt should not be called when feature is disabled
    expect(formatBpMock).not.toHaveBeenCalled();
  });

  it("deprecated skills are excluded from allSkills", async () => {
    const configRow = makeConfigRow();
    const activeSkill = makeSkillRow({
      id: 1,
      label: "resume-tailor",
      metadata: {
        status: "active",
        routerDescription: "",
        triggerExamples: [],
        negativeTriggers: [],
        taskTypes: ["chat"],
        priority: 50,
      },
    });
    const deprecatedSkill = makeSkillRow({
      id: 2,
      label: "old-skill",
      metadata: {
        status: "deprecated",
        routerDescription: "",
        triggerExamples: [],
        negativeTriggers: [],
        taskTypes: ["chat"],
        priority: 50,
      },
    });

    queueSelect([configRow]);
    queueSelect([activeSkill, deprecatedSkill]);

    const bundle = await getCachedPromptBundle();

    expect(bundle.allSkills).toHaveLength(1);
    expect(bundle.allSkills[0]?.slug).toBe("resume-tailor");
  });

  it("returns safe default bundle when no config row exists (first-run edge case)", async () => {
    queueSelect([]); // configRows empty
    queueSelect([]); // skillRows empty

    const bundle = await getCachedPromptBundle();

    expect(bundle.versionKey).toBe("default");
    expect(bundle.allSkills).toHaveLength(0);
    expect(bundle.bestPracticesText).toBe("");
  });
});
