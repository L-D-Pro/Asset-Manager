import { db, jobsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { callAI, parseJsonResponse } from "../ai-client";
import { logger } from "../logger";
import type { Job } from "@workspace/db";

interface ParsedJD {
  responsibilities: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keywords: string[];
  senioritySignal: string | null;
  location: string | null;
  remoteType: string | null;
  visaSponsorship: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

const SYSTEM_PROMPT = `You are an expert job description parser. Extract structured information from job descriptions.
Return ONLY valid JSON with this exact structure:
{
  "responsibilities": ["string"],
  "requiredSkills": ["string"],
  "niceToHaveSkills": ["string"],
  "keywords": ["string"],
  "senioritySignal": "junior|mid|senior|staff|principal|director|vp|executive|null",
  "location": "city, state/country or null",
  "remoteType": "remote|hybrid|onsite|null",
  "visaSponsorship": "yes|no|unknown|null",
  "salaryMin": number_or_null,
  "salaryMax": number_or_null,
  "salaryCurrency": "USD|GBP|EUR|null"
}
Be precise and conservative — only include skills explicitly mentioned.`;

/**
 * Runs the JD parsing pipeline:
 * 1. Calls the AI with the raw JD text
 * 2. Parses the structured response
 * 3. Updates the Job record with extracted fields
 * Returns the updated job.
 */
export async function runJdParsePipeline(
  job: Job,
  rawJdText: string,
): Promise<Job> {
  logger.info({ jobId: job.id }, "Starting JD parse pipeline");

  const result = await callAI({
    taskType: "jd_parsing",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Parse this job description for ${job.title} at ${job.company}:\n\n${rawJdText}`,
    jobId: job.id,
    userId: job.userId,
  });

  const parsed = parseJsonResponse<ParsedJD>(result.content);

  if (!parsed) {
    logger.error({ jobId: job.id, raw: result.content.slice(0, 500) }, "Failed to parse JD AI response as JSON");
    const [updated] = await db
      .update(jobsTable)
      .set({ rawJdText, status: "parse_failed" })
      .where(and(eq(jobsTable.id, job.id), eq(jobsTable.userId, job.userId)))
      .returning();
    return updated!;
  }

  const [updated] = await db
    .update(jobsTable)
    .set({
      rawJdText,
      status: "scored",
      parsedResponsibilities: parsed.responsibilities ?? [],
      parsedRequiredSkills: parsed.requiredSkills ?? [],
      parsedNiceToHaveSkills: parsed.niceToHaveSkills ?? [],
      parsedKeywords: parsed.keywords ?? [],
      parsedSenioritySignal: parsed.senioritySignal ?? null,
      location: parsed.location ?? job.location,
      remoteType: parsed.remoteType ?? job.remoteType,
      visaSponsorship: parsed.visaSponsorship ?? job.visaSponsorship,
      salaryMin: parsed.salaryMin ?? job.salaryMin,
      salaryMax: parsed.salaryMax ?? job.salaryMax,
      salaryCurrency: parsed.salaryCurrency ?? job.salaryCurrency,
      parsedStructuredData: parsed as unknown as Record<string, unknown>,
    })
    .where(and(eq(jobsTable.id, job.id), eq(jobsTable.userId, job.userId)))
    .returning();

  logger.info(
    {
      jobId: job.id,
      skills: parsed.requiredSkills?.length ?? 0,
      niceToHave: parsed.niceToHaveSkills?.length ?? 0,
    },
    "JD parse pipeline completed",
  );

  return updated!;
}
