/**
 * Tests for buildFinalChatPayload — verifies leakage checks, metadata counts,
 * and invariants that both the streaming path and inspect path rely on.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── resolveChatPrompt mock ────────────────────────────────────────────────────
const mockResolveChatPrompt = vi.fn();
vi.mock("../resolve-system-prompt", () => ({
  resolveChatPrompt: (...args: unknown[]) => mockResolveChatPrompt(...args),
}));

// ── context-builder mock ──────────────────────────────────────────────────────
vi.mock("../context-builder", () => ({
  buildParsedJdBlock: (jd: { requiredSkills: string[] }) =>
    `## Job Description (pre-parsed — do not re-extract)\n**Required:** ${jd.requiredSkills.join(", ")}`,
}));

// ── System-prompt types re-exported ──────────────────────────────────────────
import { buildFinalChatPayload } from "../final-payload-builder";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResolvedPrompt(overrides: {
  systemPrompt?: string;
  selectedSlugs?: string[];
  sections?: Array<{ lever: string; label: string; content: string }>;
  mode?: string;
  bestPracticesEnabled?: boolean;
} = {}) {
  const hasBestPractices = overrides.bestPracticesEnabled ?? false;
  const sections = overrides.sections ?? [
    { lever: "identity", label: "Identity", content: "You are a job copilot." },
    ...(hasBestPractices ? [{ lever: "best_practices", label: "Best practices", content: "## BEST PRACTICES\nBe concise." }] : []),
  ];
  const systemPrompt = overrides.systemPrompt ?? sections.map((s) => s.content).join("\n\n---\n\n");

  return {
    systemPrompt,
    sections,
    decision: {
      selectedSlugs: overrides.selectedSlugs ?? [],
      confidence: 0.9,
      reason: "test",
      candidates: [],
      llmUsed: false,
      budgetTrimmed: false,
      skillPromptTokens: 0,
    },
    mode: overrides.mode ?? "auto",
    historyTurnLimit: 20,
  };
}

const baseArgs = {
  userId: 1,
  userMessage: { content: "Help me tailor my resume", attachments: [] as never[] },
  history: [] as Array<{ role: "user" | "assistant"; content: string }>,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildFinalChatPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns messages array starting with system role", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt({ systemPrompt: "You are an assistant." }));

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.messages[0].role).toBe("system");
    expect(result.messages[0].content).toBe("You are an assistant.");
  });

  it("includes history messages after system message", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt({ systemPrompt: "Identity." }));

    const history = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi!" },
    ];
    const result = await buildFinalChatPayload({ ...baseArgs, history });

    expect(result.messages).toHaveLength(3);
    expect(result.messages[1]).toEqual({ role: "user", content: "Hello" });
    expect(result.messages[2]).toEqual({ role: "assistant", content: "Hi!" });
    expect(result.metadata.historyMessageCount).toBe(2);
  });

  it("appends parsedJd to system prompt and adds parsed_jd section", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt({ systemPrompt: "Identity." }));

    const result = await buildFinalChatPayload({
      ...baseArgs,
      parsedJd: { requiredSkills: ["TypeScript", "React"], niceToHaveSkills: [], keywords: [], senioritySignal: null, location: null, remoteType: null },
    });

    expect(result.systemPrompt).toContain("## Job Description (pre-parsed — do not re-extract)");
    expect(result.systemPrompt).toContain("TypeScript");
    expect(result.parsedJdBlock).not.toBeNull();
    expect(result.sections.some((s) => s.lever === "parsed_jd")).toBe(true);
    expect(result.metadata.parsedJdPresentButNotSectioned).toBe(false);
  });

  it("parsedJdPresentButNotSectioned is false when no parsedJd", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt());

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.parsedJdBlock).toBeNull();
    expect(result.metadata.parsedJdPresentButNotSectioned).toBe(false);
  });

  it("best practices disabled — bestPracticesEnabled is false and no warning", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt({ bestPracticesEnabled: false, systemPrompt: "Identity only." }));

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.metadata.bestPracticesEnabled).toBe(false);
    expect(result.metadata.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining("best practices")]),
    );
  });

  it("warns when best practices are disabled but text appears in prompt", async () => {
    const resolved = makeResolvedPrompt({ bestPracticesEnabled: false });
    resolved.systemPrompt = "You follow BEST PRACTICES guidelines.";

    mockResolveChatPrompt.mockResolvedValue(resolved);

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.metadata.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("best practices")]),
    );
  });

  it("fullSkillCatalogPresent is false when catalog sentinel is not in prompt", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt({ systemPrompt: "Identity. Skill: Resume-Tailoring-Core. Instructions here." }));

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.metadata.fullSkillCatalogPresent).toBe(false);
  });

  it("fullSkillCatalogPresent is true and warns when catalog sentinel leaks into prompt", async () => {
    const resolved = makeResolvedPrompt();
    resolved.systemPrompt = "## Available skills\n\nYou have these specialized skills\n- skill1";
    mockResolveChatPrompt.mockResolvedValue(resolved);

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.metadata.fullSkillCatalogPresent).toBe(true);
    expect(result.metadata.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Full skill catalog")]),
    );
  });

  it("warns when old disabled skill slug appears in prompt but was not selected", async () => {
    const resolved = makeResolvedPrompt({ selectedSlugs: [] });
    resolved.systemPrompt = "Identity.\n\nSkill: resume-ats-optimizer body text here.";
    mockResolveChatPrompt.mockResolvedValue(resolved);

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.metadata.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("resume-ats-optimizer")]),
    );
  });

  it("no warning for old slug when it is the selected skill", async () => {
    const resolved = makeResolvedPrompt({ selectedSlugs: ["resume-ats-optimizer"] });
    resolved.systemPrompt = "Identity.\n\nresume-ats-optimizer body here.";
    mockResolveChatPrompt.mockResolvedValue(resolved);

    const result = await buildFinalChatPayload({ ...baseArgs });

    const slugWarnings = result.metadata.warnings.filter((w) => w.includes("resume-ats-optimizer"));
    expect(slugWarnings).toHaveLength(0);
  });

  it("selectedSkillCount reflects routing decision", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt({ selectedSlugs: ["Resume-Tailoring-Core", "cover-letter-generator"] }));

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.metadata.selectedSkillCount).toBe(2);
  });

  it("systemPrompt equals messages[0].content", async () => {
    mockResolveChatPrompt.mockResolvedValue(makeResolvedPrompt({ systemPrompt: "Test prompt." }));

    const result = await buildFinalChatPayload({ ...baseArgs });

    expect(result.systemPrompt).toBe(result.messages[0].content);
  });

  it("produces identical messages for same args (inspect ≡ stream invariant)", async () => {
    const resolvedValue = makeResolvedPrompt({ systemPrompt: "Canonical prompt." });
    mockResolveChatPrompt.mockResolvedValue(resolvedValue);

    const history = [{ role: "user" as const, content: "Tailor my resume for this job" }];
    const args = { ...baseArgs, history };

    // Call twice with same args — simulates inspect vs stream both using buildFinalChatPayload.
    const firstCall = await buildFinalChatPayload(args);
    mockResolveChatPrompt.mockResolvedValue(resolvedValue);
    const secondCall = await buildFinalChatPayload(args);

    expect(firstCall.messages).toEqual(secondCall.messages);
  });
});
