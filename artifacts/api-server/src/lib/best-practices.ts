import { eq } from "drizzle-orm";
import { db, bestPracticesTable } from "@workspace/db";

export interface BestPracticeItem {
  description: string;
  source: "ai" | "hardcoded" | "hybrid";
  rationale?: string;
  frequency?: number; // times encountered
  sourceUrl?: string;
  sourcePost?: string;
  taskScopes?: string[];
  severity?: "guidance" | "guardrail" | "blocking";
  guardKey?: string;
  active?: boolean; // undefined means active; false means deactivated (persisted, not deleted)
}

export interface BestPracticesConfig {
  domain: string;
  title: string;
  items: BestPracticeItem[];
  hardcodedGuards: Record<string, boolean>;
  lastRefreshedAt?: Date;
}

/**
 * Format best practices items as a bullet list for injection into AI prompts.
 */
export function formatBestPracticesForPrompt(config: BestPracticesConfig): string {
  if (!config.items || config.items.length === 0) return "";
  
  const activeItems = config.items.filter((item) => {
    // Skip deactivated items (active: false means user toggled it off)
    if (item.active === false) return false;
    // Skip if explicitly disabled by hardcoded guard
    const guardKey = item.description.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (config.hardcodedGuards[guardKey] === false) return false;
    return true;
  });

  if (activeItems.length === 0) return "";

  const lines = activeItems.map((item, i) => {
    let line = `${i + 1}. ${item.description}`;
    if (item.rationale) {
      line += ` (${item.rationale})`;
    }
    return line;
  });

  return `\n\nQUALITY STANDARDS — FOLLOW ALL:\n${lines.join("\n")}`;
}

const RESUME_TAILORING_GUIDE_URL =
  "https://www.reddit.com/r/resumes/comments/1khryt7/a_practical_guide_for_tailoring_your_resume/";
const COVER_LETTER_GUIDE_URL =
  "https://www.reddit.com/r/jobsearchhacks/comments/1kq801b/after_10_years_of_helping_people_write_cover/";

const DEFAULT_BEST_PRACTICES: BestPracticesConfig = {
  domain: "general",
  title: "Job Application Best Practices",
  items: [
    {
      description:
        "Use clean command: Do not use markdown bold, italic, bullets, or code formatting. Use plain text paragraphs with standard capitalization.",
      source: "hardcoded",
      rationale:
        "Applicant Tracking Systems (ATS) may strip markdown, and plain text reads cleaner to hiring managers.",
      frequency: 0,
    },
    {
      description:
        "Tailor the resume to this specific job posting by referencing key requirements, responsibilities, and company-specific language.",
      source: "hardcoded",
      rationale:
        "Generic resumes perform poorly. Customization for the target role is the strongest predictor of interview invitations.",
      frequency: 0,
    },
    {
      description:
        "Lead with quantified impact: Start each bullet with a measurable result (numbers, percentages, revenue, users, time saved).",
      source: "hardcoded",
      rationale:
        "Recruiters spend seconds on first scan. Quantified achievements immediately communicate value.",
      frequency: 0,
    },
    {
      description:
        "No generic filler: Remove overused phrases like \"team player\", \"detail-oriented\", and \"hard worker\" entirely.",
      source: "hardcoded",
      rationale:
        "These phrases are so common they add zero signal. Replace with specific accomplishments.",
      frequency: 0,
    },
    {
      description:
        "Cover letter should be 3-5 concise paragraphs (250-400 words total), not a summary of the resume.",
      source: "hardcoded",
      rationale:
        "Cover letters are read for personality and motivation, not as a resume repeat. Long letters are skimmed or skipped.",
      frequency: 0,
    },
    {
      description:
        "Cover letter should name a specific business problem the company faces and how you would help solve it.",
      source: "hardcoded",
      rationale:
        "Generic cover letters send 0 signal. Company-specific problem + solution framing shows deep research.",
      frequency: 0,
    },
  ],
  hardcodedGuards: {
    noMarkdown: true,
    noGenericFiller: true,
    mustTailorToJob: true,
    coverLetterLengthCheck: true,
    coverLetterMustAddressBusinessProblem: true,
  },
};

const RESUME_TAILORING_BEST_PRACTICES: BestPracticesConfig = {
  domain: "resume_tailoring",
  title: "Truth-Locked Resume Tailoring Playbook",
  items: [
    {
      description:
        "Start from the current base resume and tailor it; do not create a new candidate profile from scratch.",
      source: "hybrid",
      sourceUrl: RESUME_TAILORING_GUIDE_URL,
      sourcePost: "A practical guide for tailoring your resume",
      taskScopes: ["resume_tailoring"],
      severity: "guardrail",
      guardKey: "use_base_resume",
    },
    {
      description:
        "Break the job description into required skills, nice-to-haves, responsibilities, and repeated keywords before rewriting.",
      source: "hybrid",
      sourceUrl: RESUME_TAILORING_GUIDE_URL,
      sourcePost: "A practical guide for tailoring your resume",
      taskScopes: ["resume_tailoring"],
      severity: "guidance",
      guardKey: "jd_decomposition",
    },
    {
      description:
        "Mirror job language only when it can be connected to verified experience; never keyword-stuff unsupported skills.",
      source: "hybrid",
      sourceUrl: RESUME_TAILORING_GUIDE_URL,
      sourcePost: "A practical guide for tailoring your resume",
      taskScopes: ["resume_tailoring"],
      severity: "blocking",
      guardKey: "truthful_keyword_mirroring",
    },
    {
      description:
        "Pair every important keyword with proof: a claim, result, responsibility, project, or metric already present in the source material.",
      source: "hybrid",
      sourceUrl: RESUME_TAILORING_GUIDE_URL,
      sourcePost: "A practical guide for tailoring your resume",
      taskScopes: ["resume_tailoring"],
      severity: "blocking",
      guardKey: "keywords_need_proof",
    },
    {
      description:
        "Preserve truthful scope. Do not inflate ownership, seniority, tools, credentials, dates, metrics, or business impact.",
      source: "hardcoded",
      sourceUrl: RESUME_TAILORING_GUIDE_URL,
      sourcePost: "A practical guide for tailoring your resume",
      taskScopes: ["resume_tailoring"],
      severity: "blocking",
      guardKey: "no_exaggeration",
    },
    {
      description:
        "When a required skill cannot be supported, record it as a gap instead of inventing coverage.",
      source: "hardcoded",
      sourceUrl: RESUME_TAILORING_GUIDE_URL,
      sourcePost: "A practical guide for tailoring your resume",
      taskScopes: ["resume_tailoring"],
      severity: "blocking",
      guardKey: "gaps_not_fiction",
    },
  ],
  hardcodedGuards: {
    useBaseResume: true,
    jdDecomposition: true,
    truthfulKeywordMirroring: true,
    keywordsNeedProof: true,
    noExaggeration: true,
    gapsNotFiction: true,
  },
};

const COVER_LETTER_BEST_PRACTICES: BestPracticesConfig = {
  domain: "cover_letter",
  title: "Truth-Locked Cover Letter Playbook",
  items: [
    {
      description:
        "Do not repeat the resume. Use the letter to connect 2-3 verified achievements to the employer's most important needs.",
      source: "hybrid",
      sourceUrl: COVER_LETTER_GUIDE_URL,
      sourcePost: "After 10 years of helping people write cover letters",
      taskScopes: ["cover_letter"],
      severity: "guidance",
      guardKey: "connect_not_repeat",
    },
    {
      description:
        "Use a natural, specific human voice. Avoid generic openings, filler, and broad claims of being a perfect fit.",
      source: "hybrid",
      sourceUrl: COVER_LETTER_GUIDE_URL,
      sourcePost: "After 10 years of helping people write cover letters",
      taskScopes: ["cover_letter"],
      severity: "guardrail",
      guardKey: "natural_specific_voice",
    },
    {
      description:
        "Every body or hook paragraph must be grounded in provided claims; opening and closing may be uncited only when they contain no factual claims.",
      source: "hardcoded",
      sourceUrl: COVER_LETTER_GUIDE_URL,
      sourcePost: "After 10 years of helping people write cover letters",
      taskScopes: ["cover_letter"],
      severity: "blocking",
      guardKey: "paragraph_truth_lock",
    },
    {
      description:
        "Company references must come from the job description or stored research data, not model memory.",
      source: "hardcoded",
      sourceUrl: COVER_LETTER_GUIDE_URL,
      sourcePost: "After 10 years of helping people write cover letters",
      taskScopes: ["cover_letter"],
      severity: "blocking",
      guardKey: "source_company_research",
    },
    {
      description:
        "Keep the cover letter concise and purposeful: roughly 3-5 short paragraphs focused on the employer's problem and the candidate's evidence-backed fit.",
      source: "hybrid",
      sourceUrl: COVER_LETTER_GUIDE_URL,
      sourcePost: "After 10 years of helping people write cover letters",
      taskScopes: ["cover_letter"],
      severity: "guidance",
      guardKey: "concise_problem_fit",
    },
    {
      description:
        "Do not invent motivations, relationships, company news, metrics, credentials, or experience; flag gaps or uncertainty instead.",
      source: "hardcoded",
      sourceUrl: COVER_LETTER_GUIDE_URL,
      sourcePost: "After 10 years of helping people write cover letters",
      taskScopes: ["cover_letter"],
      severity: "blocking",
      guardKey: "no_cover_letter_fiction",
    },
  ],
  hardcodedGuards: {
    connectNotRepeat: true,
    naturalSpecificVoice: true,
    paragraphTruthLock: true,
    sourceCompanyResearch: true,
    conciseProblemFit: true,
    noCoverLetterFiction: true,
  },
};

function defaultBestPracticesForDomain(domain: string): BestPracticesConfig {
  if (domain === "resume_tailoring") {
    return { ...RESUME_TAILORING_BEST_PRACTICES, items: [...RESUME_TAILORING_BEST_PRACTICES.items] };
  }
  if (domain === "cover_letter") {
    return { ...COVER_LETTER_BEST_PRACTICES, items: [...COVER_LETTER_BEST_PRACTICES.items] };
  }
  return { ...DEFAULT_BEST_PRACTICES, domain, items: [...DEFAULT_BEST_PRACTICES.items] };
}

export async function loadOrCreateBestPractices(
  domain = "general",
): Promise<BestPracticesConfig> {
  const [existing] = await db
    .select()
    .from(bestPracticesTable)
    .where(eq(bestPracticesTable.domain, domain))
    .limit(1);

  if (existing) {
    return {
      domain: existing.domain,
      title: existing.title,
      items: existing.items as BestPracticeItem[],
      hardcodedGuards: (existing.hardcodedGuards ?? {}) as Record<string, boolean>,
      lastRefreshedAt: existing.lastRefreshedAt ?? undefined,
    };
  }

  const config = defaultBestPracticesForDomain(domain);
  await db.insert(bestPracticesTable).values({
    domain: config.domain,
    title: config.title,
    items: config.items,
    hardcodedGuards: config.hardcodedGuards,
  });

  return config;
}

export async function updateBestPractices(
  domain: string,
  items: BestPracticeItem[],
): Promise<BestPracticesConfig> {
  const [existing] = await db
    .select()
    .from(bestPracticesTable)
    .where(eq(bestPracticesTable.domain, domain))
    .limit(1);

  if (!existing) {
    const config = {
      ...defaultBestPracticesForDomain(domain),
      items,
    };
    const [inserted] = await db
      .insert(bestPracticesTable)
      .values({
        domain: config.domain,
        title: config.title,
        items: config.items,
        hardcodedGuards: config.hardcodedGuards,
      })
      .returning();
    return {
      domain: inserted.domain,
      title: inserted.title,
      items: inserted.items as BestPracticeItem[],
      hardcodedGuards: (inserted.hardcodedGuards ?? {}) as Record<string, boolean>,
      lastRefreshedAt: inserted.lastRefreshedAt ?? undefined,
    };
  }

  const [updated] = await db
    .update(bestPracticesTable)
    .set({ items: items as unknown as typeof bestPracticesTable.$inferInsert.items })
    .where(eq(bestPracticesTable.id, existing.id))
    .returning();

  return {
    domain: updated.domain,
    title: updated.title,
    items: updated.items as BestPracticeItem[],
    hardcodedGuards: (updated.hardcodedGuards ?? {}) as Record<string, boolean>,
    lastRefreshedAt: updated.lastRefreshedAt ?? undefined,
  };
}

export async function refreshBestPracticesFromAI(
  domain: string,
): Promise<BestPracticesConfig> {
  const [existing] = await db
    .select()
    .from(bestPracticesTable)
    .where(eq(bestPracticesTable.domain, domain))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(bestPracticesTable)
      .set({ lastRefreshedAt: new Date() })
      .where(eq(bestPracticesTable.id, existing.id))
      .returning();
    return {
      domain: updated.domain,
      title: updated.title,
      items: updated.items as BestPracticeItem[],
      hardcodedGuards: (updated.hardcodedGuards ?? {}) as Record<string, boolean>,
      lastRefreshedAt: updated.lastRefreshedAt ?? undefined,
    };
  }

  // Insert default and mark refreshed
  const config = defaultBestPracticesForDomain(domain);
  const [inserted] = await db
    .insert(bestPracticesTable)
    .values({
      domain: config.domain,
      title: config.title,
      items: config.items,
      hardcodedGuards: config.hardcodedGuards,
      lastRefreshedAt: new Date(),
    })
    .returning();

  return {
    domain: inserted.domain,
    title: inserted.title,
    items: inserted.items as BestPracticeItem[],
    hardcodedGuards: (inserted.hardcodedGuards ?? {}) as Record<string, boolean>,
    lastRefreshedAt: inserted.lastRefreshedAt ?? undefined,
  };
}
