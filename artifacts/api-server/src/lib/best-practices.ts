import { eq } from "drizzle-orm";
import { db, bestPracticesTable } from "@workspace/db";

export interface BestPracticeItem {
  description: string;
  source: "ai" | "hardcoded" | "hybrid";
  rationale?: string;
  frequency?: number; // times encountered
}

export interface BestPracticesConfig {
  domain: string;
  title: string;
  items: BestPracticeItem[];
  hardcodedGuards: Record<string, boolean>;
  lastRefreshedAt?: Date;
}

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

  const config = { ...DEFAULT_BEST_PRACTICES, domain };
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
      ...DEFAULT_BEST_PRACTICES,
      domain,
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
  const config = { ...DEFAULT_BEST_PRACTICES, domain };
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
