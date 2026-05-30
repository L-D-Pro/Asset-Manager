import { describe, it, expect } from "vitest";
import type { ChatSkillMetadata } from "@workspace/db";
import { routeSkills, type RouterSkill, DEFAULT_ROUTING_CONFIG } from "../skill-router.js";

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
    expect(decision.reason).toContain("no skill injected");
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

  it("sets confidence to 0 (not 1) when explicit slugs match nothing", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "hi",
      mode: "explicit",
      explicitSlugs: ["deleted-skill-slug"],
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.confidence).toBe(0);
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

describe("routeSkills — attachment-aware routing", () => {
  // Uses the same mockSkills as the outer scope:
  // - "tailored-resume" (slug contains "tailor" and "resume")
  // - "cover-letter"
  // - "resume-ats" (slug contains "resume")

  it("resume + JD attachment boosts tailored-resume skill above threshold for vague message", async () => {
    // "make this fit better" has no trigger words for any skill.
    // base_resume + job → +0.4 on slugs with "tailor", +0.2 on slugs with "resume".
    // tailored-resume: 0.4 (tailor) + 0.2 (resume) = 0.6 >= AUTO_THRESHOLD (0.3) → deterministic match.
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "make this fit better",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
    });
    expect(decision.selectedSlugs).toContain("tailored-resume");
  });

  it("general chat with no attachments loads no skill", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "what is the weather today",
      attachmentKinds: [],
      mode: "auto",
    });
    expect(decision.selectedSlugs).toEqual([]);
  });

  it("strong attachment context + no deterministic match calls LLM router", async () => {
    // Neutral slugs (no "tailor"/"resume"/"audit"/"cover") so attachment boosts stay 0.
    // Triggers that won't match the vague message → zero deterministic candidates.
    // With strong attachment context + classify provided, LLM routing should fire.
    const neutralSkills: RouterSkill[] = [
      {
        slug: "skill-alpha",
        body: "Skill alpha body.",
        meta: defaultMeta({
          triggerExamples: ["very specific phrase only"],
          priority: 1,
        }),
      },
      {
        slug: "skill-beta",
        body: "Skill beta body.",
        meta: defaultMeta({
          triggerExamples: ["another very specific phrase"],
          priority: 1,
        }),
      },
    ];

    let classifyCalled = false;
    const decision = await routeSkills({
      ...baseParams(neutralSkills),
      userMessage: "is this any good?",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      classify: async () => {
        classifyCalled = true;
        return [{ slug: "skill-alpha", score: 0.7 }];
      },
    });

    expect(classifyCalled).toBe(true);
    expect(decision.llmUsed).toBe(true);
    expect(decision.selectedSlugs).toContain("skill-alpha");
  });

  it("strong attachment context + no deterministic match + no classify → no skill", async () => {
    // Neutral slugs so no attachment boosts fire.
    const neutralSkills: RouterSkill[] = [
      {
        slug: "skill-alpha",
        body: "Skill alpha body.",
        meta: defaultMeta({
          triggerExamples: ["very specific phrase only"],
          priority: 1,
        }),
      },
    ];

    const decision = await routeSkills({
      ...baseParams(neutralSkills),
      userMessage: "is this any good?",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      // No classify provided.
    });

    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.llmUsed).toBe(false);
  });

  it("strong attachment context + no deterministic match + classify returns null → no skill", async () => {
    // Neutral slugs so no attachment boosts fire.
    const neutralSkills: RouterSkill[] = [
      {
        slug: "skill-alpha",
        body: "Skill alpha body.",
        meta: defaultMeta({
          triggerExamples: ["very specific phrase only"],
          priority: 1,
        }),
      },
    ];

    const decision = await routeSkills({
      ...baseParams(neutralSkills),
      userMessage: "is this any good?",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      classify: async () => null,
    });

    expect(decision.selectedSlugs).toEqual([]);
  });
});

describe("routeSkills — attachment-aware routing (additional edge cases)", () => {
  // Shared skills with a resume-audit slug to test tailored_resume+job → audit boost.
  const skillsWithAudit: RouterSkill[] = [
    {
      slug: "resume-tailoring",
      body: "Tailor resume to JD.",
      meta: defaultMeta({
        triggerExamples: ["tailor my resume", "tailored resume"],
        negativeTriggers: ["cover letter"],
        priority: 1,
      }),
    },
    {
      slug: "resume-audit",
      body: "Audit tailored resume against JD.",
      meta: defaultMeta({
        triggerExamples: ["audit", "review this resume"],
        priority: 1,
      }),
    },
    {
      slug: "cover-letter",
      body: "Write cover letters.",
      meta: defaultMeta({
        triggerExamples: ["cover letter"],
        priority: 2,
      }),
    },
  ];

  it("resume only (no JD) + vague message + classify → LLM called (strongAttachment fires)", async () => {
    // base_resume alone counts as strong attachment, so LLM path fires when no deterministic match.
    // No JD means no tailoring boost — but we still try the LLM.
    let llmCalled = false;
    const decision = await routeSkills({
      ...baseParams(skillsWithAudit),
      userMessage: "can you help me improve this?",
      attachmentKinds: ["base_resume"], // resume only, no JD
      mode: "auto",
      classify: async () => {
        llmCalled = true;
        return [{ slug: "resume-tailoring", score: 0.65 }];
      },
    });
    expect(llmCalled).toBe(true);
    expect(decision.llmUsed).toBe(true);
  });

  it("resume only (no JD) + vague message + no classify → no skill (no auto-select without JD)", async () => {
    // Without a classify fn, strong-attachment path still returns no-skill.
    const decision = await routeSkills({
      ...baseParams(skillsWithAudit),
      userMessage: "can you help me improve this?",
      attachmentKinds: ["base_resume"],
      mode: "auto",
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.reason).toContain("No skill matched");
  });

  it("JD + tailored_resume + 'is this good?' → deterministic resume-audit (audit boost = 0.4)", async () => {
    // tailored_resume + job → +0.4 on slugs containing "audit".
    // "is this good?" has no trigger words, score before boost = 0.
    // After boost: resume-audit score = 0.4 >= AUTO_THRESHOLD (0.3) → selected.
    const decision = await routeSkills({
      ...baseParams(skillsWithAudit),
      userMessage: "is this good?",
      attachmentKinds: ["tailored_resume", "job"],
      mode: "auto",
    });
    expect(decision.selectedSlugs).toContain("resume-audit");
    expect(decision.llmUsed).toBe(false);
    expect(decision.reason).toContain("Deterministic match");
  });

  it("tailored_resume only (no job) + vague message + audit boost = 0.2 → selected if >= threshold", async () => {
    // tailored_resume alone (no job) → +0.2 on audit slugs.
    // 0.2 < AUTO_THRESHOLD (0.3) → NOT selected deterministically.
    // But strongAttachment (tailored_resume alone) → LLM called if classify provided.
    let llmCalled = false;
    const decision = await routeSkills({
      ...baseParams(skillsWithAudit),
      userMessage: "thoughts?",
      attachmentKinds: ["tailored_resume"],
      mode: "auto",
      classify: async () => {
        llmCalled = true;
        return null; // LLM not confident either
      },
    });
    expect(llmCalled).toBe(true);
    expect(decision.selectedSlugs).toEqual([]); // LLM returned null → no skill
  });
});

describe("routeSkills — routing config (tunable behavior)", () => {
  it("lower autoThreshold selects a marginal skill; higher rejects it", async () => {
    // "marginal topic" matches one trigger → score = triggerWeight (0.3 by default)
    // Threshold 0.3 → selected; threshold 0.5 → not selected.
    const skill: RouterSkill = {
      slug: "marginal",
      body: "Marginal skill",
      meta: defaultMeta({ triggerExamples: ["marginal topic"], priority: 1 }),
    };

    const selected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "marginal topic",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, autoThreshold: 0.3, triggerWeight: 0.3 },
    });
    expect(selected.selectedSlugs).toContain("marginal");

    const notSelected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "marginal topic",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, autoThreshold: 0.5, triggerWeight: 0.3 },
    });
    expect(notSelected.selectedSlugs).toEqual([]);
  });

  it("lower triggerWeight keeps score below threshold", async () => {
    const skill: RouterSkill = {
      slug: "test-skill",
      body: "Test skill",
      meta: defaultMeta({ triggerExamples: ["keyword"], priority: 1 }),
    };
    // triggerWeight=0.1, autoThreshold=0.3 → score 0.1 < 0.3 → not selected
    const decision = await routeSkills({
      ...baseParams([skill]),
      userMessage: "keyword",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, triggerWeight: 0.1, autoThreshold: 0.3 },
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.candidates[0]?.score).toBeCloseTo(0.1, 5);
  });

  it("higher negativeTriggerWeight suppresses a skill that has a matching trigger", async () => {
    // score = triggerWeight(0.3) - negativeTriggerWeight(1.0) = -0.7 → below threshold
    const skill: RouterSkill = {
      slug: "mixed-skill",
      body: "Mixed skill",
      meta: defaultMeta({
        triggerExamples: ["good phrase"],
        negativeTriggers: ["bad phrase"],
        priority: 1,
      }),
    };
    const decision = await routeSkills({
      ...baseParams([skill]),
      userMessage: "good phrase bad phrase",
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        triggerWeight: 0.3,
        negativeTriggerWeight: 1.0,
        autoThreshold: 0.3,
      },
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.candidates[0]?.score).toBeCloseTo(0.3 - 1.0, 5);
  });

  it("larger ambiguousGap causes LLM to be called for non-equal scores", async () => {
    // x has 2 triggers (score 0.6), y has 1 (score 0.3). Gap = 0.3.
    // ambiguousGap=0.4 → y is within gap (topScore - gap = 0.2, y=0.3 > 0.2) → tied → LLM called.
    const skills: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["alpha", "beta"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["alpha"], priority: 2 }) },
    ];
    let llmCalled = false;
    await routeSkills({
      ...baseParams(skills),
      userMessage: "alpha beta",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, ambiguousGap: 0.4 },
      classify: async () => { llmCalled = true; return [{ slug: "x", score: 0.9 }]; },
    });
    expect(llmCalled).toBe(true);
  });

  it("smaller ambiguousGap prevents LLM from being called for non-equal scores", async () => {
    // Same setup: x=0.6, y=0.3, gap=0.1.
    // ambiguousGap=0.1 → topScore - gap = 0.5, y=0.3 < 0.5 → not tied → no LLM.
    const skills: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["alpha", "beta"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["alpha"], priority: 2 }) },
    ];
    let llmCalled = false;
    await routeSkills({
      ...baseParams(skills),
      userMessage: "alpha beta",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, ambiguousGap: 0.1 },
      classify: async () => { llmCalled = true; return [{ slug: "x", score: 0.9 }]; },
    });
    expect(llmCalled).toBe(false);
  });

  it("zeroing boostTailorPlusJob prevents attachment routing for tailor slug", async () => {
    const skill: RouterSkill = {
      slug: "tailor-resume",
      body: "Tailor",
      meta: defaultMeta({ triggerExamples: [], priority: 1 }),
    };
    // With boost=0: score 0 < threshold → not selected
    const notSelected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "help me out",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        boostTailorPlusJob: 0.0,
        boostResumePlusJob: 0.0,
        autoThreshold: 0.3,
      },
    });
    expect(notSelected.selectedSlugs).toEqual([]);
  });

  it("raising boostTailorPlusJob above threshold selects tailor skill for vague message", async () => {
    const skill: RouterSkill = {
      slug: "tailor-resume",
      body: "Tailor",
      meta: defaultMeta({ triggerExamples: [], priority: 1 }),
    };
    // With boost=0.5 >= threshold 0.3 → selected
    const selected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "help me out",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        boostTailorPlusJob: 0.5,
        boostResumePlusJob: 0.0,
        autoThreshold: 0.3,
      },
    });
    expect(selected.selectedSlugs).toContain("tailor-resume");
  });

  it("LLM confidence above threshold selects skill (ambiguous path)", async () => {
    const ambiguous: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }) },
    ];
    const decision = await routeSkills({
      ...baseParams(ambiguous),
      userMessage: "draft a report",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, llmConfidenceThreshold: 0.5 },
      classify: async () => [{ slug: "x", score: 0.8 }],
    });
    expect(decision.selectedSlugs).toContain("x");
    expect(decision.llmUsed).toBe(true);
  });

  it("LLM confidence below threshold falls back to top deterministic (ambiguous path)", async () => {
    const ambiguous: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }) },
    ];
    const decision = await routeSkills({
      ...baseParams(ambiguous),
      userMessage: "draft a report",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, llmConfidenceThreshold: 0.9 },
      classify: async () => [{ slug: "x", score: 0.3 }], // below 0.9 threshold
    });
    // Falls back to top deterministic — still selects one skill, doesn't select nothing
    expect(decision.selectedSlugs).toHaveLength(1);
    expect(decision.reason).toContain("below confidence threshold");
    expect(decision.llmUsed).toBe(true);
  });

  it("LLM confidence below threshold selects no skill (zero-match attachment path)", async () => {
    const neutralSkill: RouterSkill[] = [
      {
        slug: "neutral",
        body: "Neutral",
        meta: defaultMeta({ triggerExamples: ["very specific phrase"], priority: 1 }),
      },
    ];
    // Zero deterministic matches → attachment LLM path → LLM score below threshold → no skill
    const decision = await routeSkills({
      ...baseParams(neutralSkill),
      userMessage: "help me out",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, llmConfidenceThreshold: 0.9 },
      classify: async () => [{ slug: "neutral", score: 0.3 }], // below 0.9
    });
    expect(decision.selectedSlugs).toEqual([]);
  });

  it("NaN score from classify fails closed — no skill selected", async () => {
    const neutralSkill: RouterSkill[] = [
      {
        slug: "neutral",
        body: "Neutral",
        meta: defaultMeta({ triggerExamples: ["very specific phrase"], priority: 1 }),
      },
    ];
    const decision = await routeSkills({
      ...baseParams(neutralSkill),
      userMessage: "help me out",
      attachmentKinds: ["base_resume"],
      mode: "auto",
      classify: async () => [{ slug: "neutral", score: NaN }],
    });
    expect(decision.selectedSlugs).toEqual([]);
  });

  it("unknown LLM slug is filtered out and falls back to deterministic top", async () => {
    const realSkills: RouterSkill[] = [
      { slug: "real-a", body: "A", meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }) },
      { slug: "real-b", body: "B", meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }) },
    ];
    const decision = await routeSkills({
      ...baseParams(realSkills),
      userMessage: "draft a report",
      mode: "auto",
      classify: async () => [{ slug: "phantom-unknown-slug", score: 0.99 }],
    });
    // Unknown slug filtered → no confident results → falls back to top deterministic
    expect(decision.selectedSlugs).not.toContain("phantom-unknown-slug");
    expect(decision.selectedSlugs).toHaveLength(1);
  });

  it("existing default behavior is preserved (no regression)", async () => {
    // All existing tests continue to pass with DEFAULT_ROUTING_CONFIG as the implicit config.
    // This test uses defaults explicitly to document the contract.
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "tailor my resume for this job",
      mode: "auto",
      routingConfig: DEFAULT_ROUTING_CONFIG,
    });
    expect(decision.selectedSlugs).toEqual(["tailored-resume"]);
    expect(decision.reason).toContain("Deterministic match");
  });

  it("no fallback-to-all in auto mode regardless of config", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "what is the meaning of life",
      attachmentKinds: [],
      mode: "auto",
      routingConfig: DEFAULT_ROUTING_CONFIG,
    });
    expect(decision.selectedSlugs).toEqual([]); // no skill selected — not "less than all", but zero
  });
});

describe("routeSkills — obvious resume-tailoring deterministic path", () => {
  // Shared skill set with a tailor slug and a generic skill.
  const tailorSkill: RouterSkill = {
    slug: "resume-tailoring",
    body: "Tailors resume to a job description.",
    meta: defaultMeta({ triggerExamples: ["tailor"], priority: 1 }),
  };
  const genericSkill: RouterSkill = {
    slug: "general-advice",
    body: "General career advice.",
    meta: defaultMeta({ triggerExamples: ["help"], priority: 2 }),
  };

  it("base_resume + job attachment → deterministic tailor selection, llmUsed: false", async () => {
    // boostTailorPlusJob=0.4, autoThreshold=0.3 → resume-tailoring score = 0.4 >= 0.3 → above threshold.
    // isObviousTailoringRequest detects base_resume+job → short-circuit, no LLM.
    let llmCalled = false;
    const decision = await routeSkills({
      ...baseParams([tailorSkill, genericSkill]),
      userMessage: "Tailor my resume",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        boostTailorPlusJob: 0.4,
        boostResumePlusJob: 0.0,
        autoThreshold: 0.3,
        ambiguousGap: 0.15,
      },
      classify: async () => {
        llmCalled = true;
        return [{ slug: "general-advice", score: 0.9 }];
      },
    });
    expect(decision.selectedSlugs).toEqual(["resume-tailoring"]);
    expect(decision.llmUsed).toBe(false);
    expect(decision.reason).toContain("deterministic");
    expect(llmCalled).toBe(false);
  });

  it("base_resume + tailor language → deterministic, llmUsed: false", async () => {
    // No job attachment, but "tailor" verb present with base_resume.
    // boostResumePlusJob=0 (no job), triggerWeight=0.3 → trigger "tailor" matches → score=0.3 >= threshold.
    let llmCalled = false;
    const decision = await routeSkills({
      ...baseParams([tailorSkill, genericSkill]),
      userMessage: "Please tailor my resume for this role",
      attachmentKinds: ["base_resume"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        triggerWeight: 0.3,
        autoThreshold: 0.3,
        ambiguousGap: 0.15,
      },
      classify: async () => {
        llmCalled = true;
        return [{ slug: "general-advice", score: 0.9 }];
      },
    });
    expect(decision.llmUsed).toBe(false);
    expect(decision.selectedSlugs).toEqual(["resume-tailoring"]);
    expect(llmCalled).toBe(false);
  });

  it("tied non-obvious request with matching triggers calls LLM classifier", async () => {
    // Two non-tailoring skills tied on the same trigger → LLM should break the tie.
    const skillA: RouterSkill = {
      slug: "x-skill",
      body: "Skill X",
      meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }),
    };
    const skillB: RouterSkill = {
      slug: "y-skill",
      body: "Skill Y",
      meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }),
    };
    let classifyCalled = false;
    const decision = await routeSkills({
      ...baseParams([skillA, skillB]),
      userMessage: "can you give me a report on this",
      attachmentKinds: [],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        triggerWeight: 0.4,
        autoThreshold: 0.3,
        ambiguousGap: 0.5,
      },
      classify: async () => {
        classifyCalled = true;
        return [{ slug: "x-skill", score: 0.8 }];
      },
    });
    // Both match "report" → score 0.4 each → tied → LLM resolves tie.
    expect(classifyCalled).toBe(true);
    expect(decision.llmUsed).toBe(true);
  });

  it("non-obvious request with both attachments but unrelated message does NOT trigger obvious path", async () => {
    // base_resume + job attached but message has no application-intent words.
    const decision = await routeSkills({
      ...baseParams([tailorSkill, genericSkill]),
      userMessage: "what are the visa requirements here?",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        boostTailorPlusJob: 0.4,
        autoThreshold: 0.3,
      },
    });
    // isObviousTailoringRequest returns false (no application-intent words).
    // The boost still applies so tailor skill gets 0.4 score — but normal routing.
    expect(decision.llmUsed).toBe(false); // still deterministic (clear winner)
    expect(decision.reason).not.toMatch(/obvious/i); // did NOT take the obvious path
  });

  it("job attachment + 'resume' in message → obvious path (Pattern 3)", async () => {
    // Spec requirement: job attachment + "resume" in message counts as obvious.
    const decision = await routeSkills({
      ...baseParams([tailorSkill, genericSkill]),
      userMessage: "can you tailor my resume to match this job?",
      attachmentKinds: ["job"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        boostTailorPlusJob: 0.0,
        boostResumePlusJob: 0.4,
        autoThreshold: 0.3,
      },
    });
    expect(decision.llmUsed).toBe(false);
    expect(decision.selectedSlugs).toEqual(["resume-tailoring"]);
    expect(decision.reason).toMatch(/deterministic/i);
  });

  it("explicit mode is unaffected — obvious path does NOT run in explicit mode", async () => {
    // Even with base_resume + job, explicit mode should just use explicitSlugs.
    const decision = await routeSkills({
      ...baseParams([tailorSkill, genericSkill]),
      userMessage: "do something",
      attachmentKinds: ["base_resume", "job"],
      mode: "explicit",
      explicitSlugs: ["general-advice"],
    });
    expect(decision.selectedSlugs).toEqual(["general-advice"]);
  });

  it("debug_all mode is unaffected — all skills selected regardless of obvious-path", async () => {
    // debug_all bypasses all routing logic including the obvious-path short-circuit.
    const decision = await routeSkills({
      ...baseParams([tailorSkill, genericSkill]),
      userMessage: "do something",
      attachmentKinds: ["base_resume", "job"],
      mode: "debug_all",
    });
    expect(decision.selectedSlugs).toEqual(["resume-tailoring", "general-advice"]);
    expect(decision.llmUsed).toBe(false);
    expect(decision.reason).toContain("Debug mode");
  });
});
