/**
 * Resume-routing quality tests — mocked LLM router.
 *
 * Verifies that realistic resume/JD attachment combinations route to the
 * correct skill slugs WITHOUT calling live OpenRouter.  All LLM paths use
 * the `classify` injection on `routeSkills`.
 *
 * Scenarios covered:
 *   1. resume + JD + explicit tailor request  → resume-tailoring (deterministic)
 *   2. resume + JD + vague "make this fit"    → resume-tailoring (attachment boost, deterministic)
 *   3. tailored_resume + JD + "is this good?" → resume-audit (audit boost, deterministic)
 *   4. resume only + "tailor this" + mock LLM → resume-tailoring (LLM path, no live auth)
 *   5. resume only + "tailor this" + no LLM   → no skill (product: missing JD)
 *
 * Each test also asserts on the assembled system-prompt:
 *   ✓ selected skill body is present
 *   ✓ non-selected skill bodies are absent
 *   ✓ skill catalog is NOT injected
 *   ✓ selectedSlugs do not equal all skills (no fallback-to-all)
 */

import { describe, it, expect } from "vitest";
import type { ChatSkillMetadata } from "@workspace/db";
import { routeSkills, type RouterSkill, DEFAULT_ROUTING_CONFIG } from "../skill-router.js";
import { buildSystemPrompt } from "../system-prompt.js";

// ── Shared skill definitions (production-realistic slugs) ──────────────────

const defaultMeta = (partial: Partial<ChatSkillMetadata>): ChatSkillMetadata => ({
  routerDescription: "",
  triggerExamples: [],
  negativeTriggers: [],
  taskTypes: ["chat"],
  priority: 99,
  status: "active",
  ...partial,
});

/** resume-tailoring: slug contains "tailor" AND "resume" → boostTailorPlusJob + boostResumePlusJob */
const RESUME_TAILORING: RouterSkill = {
  slug: "resume-tailoring",
  body: "RESUME-TAILORING-BODY: You tailor resumes to job descriptions.",
  meta: defaultMeta({
    routerDescription: "Tailors a resume to a specific job description",
    triggerExamples: ["tailor my resume", "tailored resume", "fit this job"],
    negativeTriggers: ["cover letter"],
    priority: 1,
  }),
};

/** resume-audit: slug contains "audit" → boostAuditTailoredJob when tailored_resume + job */
const RESUME_AUDIT: RouterSkill = {
  slug: "resume-audit",
  body: "RESUME-AUDIT-BODY: You audit tailored resumes against job descriptions.",
  meta: defaultMeta({
    routerDescription: "Audits a tailored resume against a job description",
    triggerExamples: ["audit this", "review this resume"],
    priority: 1,
  }),
};

/** cover-letter: present to confirm it is NOT selected in resume scenarios */
const COVER_LETTER: RouterSkill = {
  slug: "cover-letter",
  body: "COVER-LETTER-BODY: You write cover letters.",
  meta: defaultMeta({
    routerDescription: "Writes cover letters",
    triggerExamples: ["cover letter", "application letter"],
    priority: 2,
  }),
};

const ALL_SKILLS = [RESUME_TAILORING, RESUME_AUDIT, COVER_LETTER];
const ALL_SLUGS = ALL_SKILLS.map((s) => s.slug);

/** Build params with sensible defaults for this test suite. */
const params = (overrides: Partial<Parameters<typeof routeSkills>[0]> = {}): Parameters<typeof routeSkills>[0] => ({
  userMessage: "",
  skills: ALL_SKILLS,
  attachmentKinds: [] as string[],
  mode: "auto" as const,
  tokenBudget: 10_000,
  maxSkills: 1,
  routingConfig: DEFAULT_ROUTING_CONFIG,
  ...overrides,
});

/**
 * Helper: runs routeSkills, then builds the system prompt from the result
 * and returns both so tests can assert on routing and prompt in one call.
 */
async function routeAndBuildPrompt(
  overrides: Parameters<typeof params>[0] = {},
): Promise<{ selectedSlugs: string[]; prompt: string; llmUsed: boolean; reason: string }> {
  const decision = await routeSkills(params(overrides));

  const selectedSkills = ALL_SKILLS.filter((s) =>
    decision.selectedSlugs.includes(s.slug),
  );

  const prompt = buildSystemPrompt({
    identityText: "You are a career copilot.",
    catalog: [], // no catalog — invariant under test
    skills: selectedSkills.map((s) => ({ slug: s.slug, body: s.body })),
    bestPracticesText: "",
    attachments: [],
  });

  return {
    selectedSlugs: decision.selectedSlugs,
    prompt,
    llmUsed: decision.llmUsed,
    reason: decision.reason,
  };
}

// ── Scenario 1: explicit tailor request + resume + JD ─────────────────────

describe("resume-routing quality — scenario 1: explicit tailor request + resume + JD", () => {
  it("routes to resume-tailoring (deterministic, no LLM)", async () => {
    const { selectedSlugs, llmUsed } = await routeAndBuildPrompt({
      userMessage: "Tailor my resume to this JD",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(selectedSlugs).toEqual(["resume-tailoring"]);
    expect(llmUsed).toBe(false);
  });

  it("prompt contains resume-tailoring body", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor my resume to this JD",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(prompt).toContain("RESUME-TAILORING-BODY");
  });

  it("prompt does not contain audit or cover-letter bodies", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor my resume to this JD",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(prompt).not.toContain("RESUME-AUDIT-BODY");
    expect(prompt).not.toContain("COVER-LETTER-BODY");
  });

  it("prompt does not contain a skill catalog section", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor my resume to this JD",
      attachmentKinds: ["base_resume", "job"],
    });

    // buildSystemPrompt only emits catalog when catalog[] is non-empty;
    // we pass catalog:[] so this marker must never appear.
    expect(prompt).not.toContain("Available skills:");
    expect(prompt).not.toContain("skill_catalog");
  });

  it("does not inject all skills (no fallback-to-all)", async () => {
    const { selectedSlugs } = await routeAndBuildPrompt({
      userMessage: "Tailor my resume to this JD",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(selectedSlugs.length).toBeLessThan(ALL_SLUGS.length);
  });
});

// ── Scenario 2: vague message + resume + JD (attachment boost path) ────────

describe("resume-routing quality — scenario 2: vague 'make this fit better' + resume + JD", () => {
  /**
   * "make this fit better" has no trigger words for any skill.
   * base_resume + job → boostTailorPlusJob(0.4) on "resume-tailoring" (slug has "tailor")
   *                    + boostResumePlusJob(0.2) on "resume-tailoring" (slug has "resume")
   * → total score 0.6 ≥ autoThreshold(0.3) → deterministic win.
   */
  it("routes to resume-tailoring via attachment boost (deterministic, no LLM)", async () => {
    const { selectedSlugs, llmUsed, reason } = await routeAndBuildPrompt({
      userMessage: "Make this fit better",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(selectedSlugs).toEqual(["resume-tailoring"]);
    expect(llmUsed).toBe(false);
    // Obvious-path short-circuit fires for base_resume + job (Phase 5): reason reflects that.
    expect(reason).toMatch(/deterministic/i);
  });

  it("prompt contains resume-tailoring body", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Make this fit better",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(prompt).toContain("RESUME-TAILORING-BODY");
  });

  it("prompt does not contain non-selected skill bodies", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Make this fit better",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(prompt).not.toContain("RESUME-AUDIT-BODY");
    expect(prompt).not.toContain("COVER-LETTER-BODY");
  });

  it("does not inject all skills", async () => {
    const { selectedSlugs } = await routeAndBuildPrompt({
      userMessage: "Make this fit better",
      attachmentKinds: ["base_resume", "job"],
    });

    expect(selectedSlugs.length).toBeLessThan(ALL_SLUGS.length);
  });
});

// ── Scenario 3: vague review + tailored_resume + JD → resume-audit ─────────

describe("resume-routing quality — scenario 3: 'is this good?' + tailored_resume + JD", () => {
  /**
   * "is this good?" has no trigger words for resume-audit.
   * tailored_resume + job → boostAuditTailoredJob(0.4) on "resume-audit" (slug has "audit")
   * → 0.4 ≥ autoThreshold(0.3) → deterministic win.
   */
  it("routes to resume-audit via audit boost (deterministic, no LLM)", async () => {
    const { selectedSlugs, llmUsed, reason } = await routeAndBuildPrompt({
      userMessage: "Is this good?",
      attachmentKinds: ["tailored_resume", "job"],
    });

    expect(selectedSlugs).toEqual(["resume-audit"]);
    expect(llmUsed).toBe(false);
    expect(reason).toContain("Deterministic match");
  });

  it("prompt contains resume-audit body", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Is this good?",
      attachmentKinds: ["tailored_resume", "job"],
    });

    expect(prompt).toContain("RESUME-AUDIT-BODY");
  });

  it("prompt does not contain tailoring or cover-letter bodies", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Is this good?",
      attachmentKinds: ["tailored_resume", "job"],
    });

    expect(prompt).not.toContain("RESUME-TAILORING-BODY");
    expect(prompt).not.toContain("COVER-LETTER-BODY");
  });

  it("does not inject all skills", async () => {
    const { selectedSlugs } = await routeAndBuildPrompt({
      userMessage: "Is this good?",
      attachmentKinds: ["tailored_resume", "job"],
    });

    expect(selectedSlugs.length).toBeLessThan(ALL_SLUGS.length);
  });
});

// ── Scenario 4: resume only + vague + mocked LLM → resume-tailoring ─────────

describe("resume-routing quality — scenario 4: 'tailor this' + resume only + mocked LLM", () => {
  /**
   * "tailor this" does NOT match trigger "tailor my resume" (substring mismatch).
   * No JD → no boostTailorPlusJob.
   * Score = 0 for all skills → no deterministic match.
   * base_resume counts as strong attachment → LLM classify path fires.
   * Mock LLM returns high-confidence resume-tailoring → selected.
   *
   * This proves the LLM routing path works with a mocked response,
   * without requiring live OpenRouter auth.
   */
  const mockClassify = async () => [{ slug: "resume-tailoring", score: 0.85 }];

  it("calls the mocked LLM classifier (no live OpenRouter auth needed)", async () => {
    let classifyCalled = false;
    await routeSkills(
      params({
        userMessage: "Tailor this",
        attachmentKinds: ["base_resume"],
        classify: async (skills, msg) => {
          classifyCalled = true;
          return mockClassify();
        },
      }),
    );

    expect(classifyCalled).toBe(true);
  });

  it("routes to resume-tailoring via mocked LLM response", async () => {
    const { selectedSlugs, llmUsed } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: mockClassify,
    });

    expect(selectedSlugs).toEqual(["resume-tailoring"]);
    expect(llmUsed).toBe(true);
  });

  it("prompt contains resume-tailoring body after LLM routing", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: mockClassify,
    });

    expect(prompt).toContain("RESUME-TAILORING-BODY");
  });

  it("prompt does not contain non-selected skill bodies", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: mockClassify,
    });

    expect(prompt).not.toContain("RESUME-AUDIT-BODY");
    expect(prompt).not.toContain("COVER-LETTER-BODY");
  });

  it("prompt does not contain skill catalog", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: mockClassify,
    });

    expect(prompt).not.toContain("Available skills:");
    expect(prompt).not.toContain("skill_catalog");
  });

  it("does not inject all skills", async () => {
    const { selectedSlugs } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: mockClassify,
    });

    expect(selectedSlugs.length).toBeLessThan(ALL_SLUGS.length);
  });
});

// ── Scenario 5: resume only + no LLM → no skill (product behavior) ──────────

describe("resume-routing quality — scenario 5: 'tailor this' + resume only + no classify", () => {
  /**
   * Same as scenario 4 but no `classify` provided.
   * Product behavior: without a JD, no skill is auto-selected even with attachment context.
   * Fail-closed: unknown intent → no injection.
   */
  it("selects no skill when no classify is provided", async () => {
    const { selectedSlugs, llmUsed } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      // no classify
    });

    expect(selectedSlugs).toEqual([]);
    expect(llmUsed).toBe(false);
  });

  it("prompt contains no skill bodies when no skill is selected", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
    });

    expect(prompt).not.toContain("RESUME-TAILORING-BODY");
    expect(prompt).not.toContain("RESUME-AUDIT-BODY");
    expect(prompt).not.toContain("COVER-LETTER-BODY");
  });

  it("prompt does not inject skill catalog", async () => {
    const { prompt } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
    });

    expect(prompt).not.toContain("Available skills:");
    expect(prompt).not.toContain("skill_catalog");
  });

  it("reason describes the no-match outcome", async () => {
    const { reason } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
    });

    expect(reason).toContain("No skill matched");
  });
});

// ── Safety: fail-closed on low-confidence LLM (keeps existing contract) ──────

describe("resume-routing quality — safety: LLM fail-closed invariants", () => {
  it("LLM score below confidence threshold → no skill (zero-match attachment path)", async () => {
    const { selectedSlugs, llmUsed } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, llmConfidenceThreshold: 0.9 },
      classify: async () => [{ slug: "resume-tailoring", score: 0.3 }], // below 0.9
    });

    expect(selectedSlugs).toEqual([]);
    expect(llmUsed).toBe(false); // LLM ran in attachment path but result discarded — no credit
  });

  it("LLM returns null → no skill injected", async () => {
    const { selectedSlugs } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: async () => null,
    });

    expect(selectedSlugs).toEqual([]);
  });

  it("LLM returns unknown slug → filtered out, no skill", async () => {
    const { selectedSlugs } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: async () => [{ slug: "phantom-slug", score: 0.99 }],
    });

    expect(selectedSlugs).not.toContain("phantom-slug");
    expect(selectedSlugs).toEqual([]);
  });

  it("LLM returns NaN score → filtered out (fail-closed)", async () => {
    const { selectedSlugs } = await routeAndBuildPrompt({
      userMessage: "Tailor this",
      attachmentKinds: ["base_resume"],
      classify: async () => [{ slug: "resume-tailoring", score: NaN }],
    });

    expect(selectedSlugs).toEqual([]);
  });
});
