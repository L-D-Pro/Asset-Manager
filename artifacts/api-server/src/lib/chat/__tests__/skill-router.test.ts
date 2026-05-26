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

describe("routeSkills — attachment-aware routing", () => {
  // Use neutral skill slugs (no "tailor"/"resume"/"cover" substrings) to isolate
  // attachment boosts from slug-substring matching.
  const neutralSkills: RouterSkill[] = [
    {
      slug: "skill-alpha",
      body: "Tailor a resume to a job description.",
      meta: defaultMeta({
        routerDescription: "Tailors a resume to a JD",
        triggerExamples: ["tailor my resume", "resume for this job", "tailored resume"],
        negativeTriggers: ["cover letter"],
        priority: 1,
      }),
    },
    {
      slug: "skill-beta",
      body: "Write cover letters.",
      meta: defaultMeta({
        routerDescription: "Writes cover letters",
        triggerExamples: ["cover letter", "application letter"],
        priority: 1,
      }),
    },
    {
      slug: "skill-gamma",
      body: "Optimize resume for ATS.",
      meta: defaultMeta({
        routerDescription: "Optimizes for ATS",
        triggerExamples: ["ats", "keyword match"],
        priority: 2,
      }),
    },
  ];

  it("vague message with base_resume + job attachments calls LLM (no deterministic match)", async () => {
    let classified = false;
    const decision = await routeSkills({
      ...baseParams(neutralSkills),
      userMessage: "is this any good?",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      classify: async () => {
        classified = true;
        return [{ slug: "skill-alpha", score: 0.7 }];
      },
    });
    expect(classified).toBe(true);
    expect(decision.llmUsed).toBe(true);
    expect(decision.selectedSlugs).toContain("skill-alpha");
  });

  it("vague message + strong attachments + no classify → no skill selected", async () => {
    const decision = await routeSkills({
      ...baseParams(neutralSkills),
      userMessage: "is this any good?",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      // no classify provided
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.llmUsed).toBe(false);
  });

  it("vague message + strong attachments + classify returns null → no skill selected", async () => {
    const decision = await routeSkills({
      ...baseParams(neutralSkills),
      userMessage: "is this any good?",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      classify: async () => null,
    });
    expect(decision.selectedSlugs).toEqual([]);
  });

  it("general chat with no attachments loads no skill", async () => {
    const decision = await routeSkills({
      ...baseParams(neutralSkills),
      userMessage: "what is the weather today?",
      attachmentKinds: [],
      mode: "auto",
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.reason).toContain("No skill matched");
  });

  it("attachment boost pushes a skill above threshold for vague message with real slugs", async () => {
    // "tailored-resume" slug contains "tailor" → gets +0.4 from base_resume+job combo
    // That alone exceeds AUTO_THRESHOLD (0.3), so it's selected deterministically.
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
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "make this fit better",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
    });
    expect(decision.selectedSlugs).toContain("tailored-resume");
  });
});
