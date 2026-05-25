import { describe, it, expect } from "vitest";
import type { ChatSkillMetadata } from "@workspace/db";
import { routeSkills, type RouterSkill } from "../skill-router.js";

const defaultMeta = (partial: Partial<ChatSkillMetadata>): ChatSkillMetadata => ({
  routerDescription: "",
  triggerExamples: [],
  negativeTriggers: [],
  taskTypes: ["chat"],
  priority: 99,
  status: "active",
  ...partial,
});

const mockSkills: RouterSkill[] = [
  {
    slug: "tailored-resume",
    body: "You tailor resumes to a job description.",
    meta: defaultMeta({
      routerDescription: "Tailors a resume to a JD",
      triggerExamples: ["tailor my resume", "tailored resume", "resume for this job"],
      negativeTriggers: ["cover letter"],
      priority: 1,
    }),
  },
  {
    slug: "cover-letter",
    body: "You write cover letters.",
    meta: defaultMeta({
      routerDescription: "Writes cover letters",
      triggerExamples: ["cover letter", "application letter"],
      priority: 1,
    }),
  },
  {
    slug: "resume-ats",
    body: "You optimize resumes for ATS.",
    meta: defaultMeta({
      routerDescription: "Optimizes resumes for ATS",
      triggerExamples: ["ats", "applicant tracking", "keyword match"],
      negativeTriggers: ["cover letter", "tailor my resume"],
      priority: 2,
    }),
  },
];

const baseParams = (skills: RouterSkill[]) => ({
  userMessage: "",
  skills,
  attachmentKinds: [] as string[],
  tokenBudget: 5000,
  maxSkills: 1,
});

describe("routeSkills — mode: none", () => {
  it('returns empty selection with reason "catalog only"', async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "tailor my resume please",
      mode: "none",
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.confidence).toBe(0);
    expect(decision.reason).toContain("catalog only");
    expect(decision.llmUsed).toBe(false);
    expect(decision.skillPromptTokens).toBe(0);
  });
});

describe("routeSkills — mode: debug_all", () => {
  it("returns all skill slugs and bypasses cap/budget", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "anything",
      mode: "debug_all",
      maxSkills: 1, // ignored in debug_all
      tokenBudget: 1, // ignored in debug_all
    });
    expect(decision.selectedSlugs).toEqual(["tailored-resume", "cover-letter", "resume-ats"]);
    expect(decision.confidence).toBe(1);
    expect(decision.budgetTrimmed).toBe(false);
    expect(decision.reason).toContain("Debug mode");
  });
});

describe("routeSkills — mode: explicit", () => {
  it("returns the user's picked slugs that exist", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "hi",
      mode: "explicit",
      explicitSlugs: ["tailored-resume", "cover-letter"],
      maxSkills: 2,
    });
    expect(decision.selectedSlugs).toEqual(["tailored-resume", "cover-letter"]);
    expect(decision.confidence).toBe(1);
  });

  it("returns empty when explicit slugs match nothing", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "hi",
      mode: "explicit",
      explicitSlugs: ["nonexistent"],
    });
    expect(decision.selectedSlugs).toEqual([]);
  });

  it("falls through to auto when explicit slugs are empty", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "write my cover letter",
      mode: "explicit",
      explicitSlugs: [],
    });
    expect(decision.selectedSlugs).toContain("cover-letter");
  });
});

describe("routeSkills — mode: auto (deterministic, req 8)", () => {
  it("resume prompts load the resume skill only", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "tailor my resume for this job",
      mode: "auto",
    });
    expect(decision.selectedSlugs).toEqual(["tailored-resume"]);
    expect(decision.reason).toContain("Deterministic match");
  });

  it("cover-letter prompts load the cover-letter skill only", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "write my cover letter",
      mode: "auto",
    });
    expect(decision.selectedSlugs).toEqual(["cover-letter"]);
  });

  it("general chat loads no skill (no fallback-to-all)", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "what is the weather today",
      mode: "auto",
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.reason).toContain("No skill matched");
  });

  it("a single matching trigger is enough to select", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "check my ats score",
      mode: "auto",
    });
    expect(decision.selectedSlugs).toEqual(["resume-ats"]);
  });

  it("records candidate scores in the decision", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "tailor my resume for this job",
      mode: "auto",
    });
    expect(decision.candidates).toHaveLength(3);
    expect(decision.candidates.find((c) => c.slug === "tailored-resume")?.score).toBeGreaterThan(0);
  });

  it("does not inject conflicting skills together without an explicit request", async () => {
    // A message that brushes two skills still yields at most one in auto.
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "tailor my resume and also mention ats keyword match",
      mode: "auto",
      maxSkills: 1,
    });
    expect(decision.selectedSlugs.length).toBeLessThanOrEqual(1);
  });
});

describe("routeSkills — maxSkills cap", () => {
  it("caps an explicit multi-pick to maxSkills", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "hi",
      mode: "explicit",
      explicitSlugs: ["tailored-resume", "cover-letter", "resume-ats"],
      maxSkills: 2,
    });
    expect(decision.selectedSlugs).toHaveLength(2);
  });
});

describe("routeSkills — LLM classification path", () => {
  const ambiguous: RouterSkill[] = [
    { slug: "x", body: "Skill X", meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }) },
    { slug: "y", body: "Skill Y", meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }) },
  ];

  it("calls classify when ≥2 candidates tie", async () => {
    let called = false;
    const decision = await routeSkills({
      ...baseParams(ambiguous),
      userMessage: "draft a report",
      mode: "auto",
      classify: async () => {
        called = true;
        return [{ slug: "x", score: 0.8 }];
      },
    });
    expect(called).toBe(true);
    expect(decision.llmUsed).toBe(true);
    expect(decision.selectedSlugs).toContain("x");
  });

  it("falls back to the top deterministic match when classify returns null", async () => {
    const decision = await routeSkills({
      ...baseParams(ambiguous),
      userMessage: "draft a report",
      mode: "auto",
      classify: async () => null,
    });
    // The LLM leg ran (llmUsed) but its empty result was discarded.
    expect(decision.llmUsed).toBe(true);
    expect(decision.selectedSlugs).toHaveLength(1);
  });
});

describe("routeSkills — token budget", () => {
  it("trims an explicit multi-pick to fit the budget, keeping highest priority", async () => {
    const skills: RouterSkill[] = [
      { slug: "big", body: "a".repeat(2000), meta: defaultMeta({ priority: 1 }) }, // ~500 tok
      { slug: "small", body: "b".repeat(100), meta: defaultMeta({ priority: 2 }) }, // ~25 tok
    ];
    const decision = await routeSkills({
      ...baseParams(skills),
      userMessage: "hi",
      mode: "explicit",
      explicitSlugs: ["big", "small"],
      maxSkills: 2,
      tokenBudget: 100,
    });
    expect(decision.budgetTrimmed).toBe(true);
    expect(decision.selectedSlugs).toEqual(["big"]);
  });
});
