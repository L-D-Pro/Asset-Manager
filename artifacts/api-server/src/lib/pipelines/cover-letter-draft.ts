import { db, coverLetterVersionsTable } from "@workspace/db";
import { callAI, parseJsonResponse } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { logger } from "../logger";
import type { Job, RoleProfile, Claim } from "@workspace/db";

interface AnnotatedParagraph {
  text: string;
  claimIds: number[];
  role: "opening" | "body" | "closing" | "hook";
}

interface CoverLetterResult {
  subject: string;
  paragraphs: AnnotatedParagraph[];
  fullText: string;
}

const SYSTEM_PROMPT = `You are an expert career coach specializing in cover letters.
Your task is to draft a professional cover letter using ONLY the provided claims as source material.
CRITICAL RULES — NEVER VIOLATE:
1. Every substantive claim in the letter MUST trace back to a provided claim by ID.
2. Do NOT invent achievements, metrics, or experiences not in the claims.
3. The letter should be authentic, concise (3-4 paragraphs), and tailored to the specific role.
4. Each paragraph must cite which claim IDs it draws from.

Return ONLY valid JSON with this exact structure:
{
  "subject": "Application for [Role] at [Company]",
  "paragraphs": [
    {
      "text": "Paragraph text",
      "claimIds": [claim_id_numbers],
      "role": "opening|hook|body|closing"
    }
  ],
  "fullText": "Complete cover letter text joined from paragraphs"
}`;

/**
 * Runs the cover letter drafting pipeline:
 * 1. Matches claims to the job (or uses provided claimIds)
 * 2. Calls the AI to draft a cover letter with per-paragraph claim attribution
 * 3. Stores the result as a new CoverLetterVersion in pending_approval state
 * Returns the new CoverLetterVersion.
 */
export async function runCoverLetterPipeline(
  job: Job,
  roleProfile: RoleProfile | null,
  allClaims: Claim[],
  claimIds?: number[],
): Promise<typeof coverLetterVersionsTable.$inferSelect> {
  logger.info({ jobId: job.id, claimIds }, "Starting cover letter draft pipeline");

  let selectedClaims: Claim[];
  if (claimIds && claimIds.length > 0) {
    selectedClaims = allClaims.filter((c) => claimIds.includes(c.id));
  } else {
    const matches = matchClaimsToJob(job, allClaims);
    selectedClaims = matches.slice(0, 10).map((m) => m.claim);
  }

  if (selectedClaims.length === 0) {
    logger.warn({ jobId: job.id }, "No claims available for cover letter");
    const [row] = await db
      .insert(coverLetterVersionsTable)
      .values({
        jobId: job.id,
        label: "AI drafted — no claims available",
        status: "pending_approval",
        claimIds: [],
        notes: "No matching claims found. Add claims to your Claims Ledger first.",
        draftContent: "",
        annotatedParagraphs: [],
      })
      .returning();
    return row!;
  }

  const claimsContext = selectedClaims
    .map(
      (c) =>
        `[ID:${c.id}] ${c.summary}${c.evidence ? ` (Evidence: ${c.evidence})` : ""}`,
    )
    .join("\n");

  const profileContext = roleProfile
    ? `Applying via role profile: ${roleProfile.name}. `
    : "";

  const jobContext = `
${profileContext}Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? "Not specified"}
Remote: ${job.remoteType ?? "Not specified"}
Required Skills: ${(job.parsedRequiredSkills ?? []).join(", ") || "Not parsed yet"}
Responsibilities: ${(job.parsedResponsibilities ?? []).join("; ") || "Not parsed yet"}
`.trim();

  const result = await callAI({
    taskType: "cover_letter",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Draft a cover letter for this job:\n\n${jobContext}\n\nAvailable claims (use ONLY these):\n${claimsContext}`,
    jobId: job.id,
  });

  const parsed = parseJsonResponse<CoverLetterResult>(result.content);

  const paragraphs = parsed?.paragraphs ?? [];
  const usedClaimIds = [...new Set(paragraphs.flatMap((p) => p.claimIds))];
  const fullText = parsed?.fullText ?? result.content;

  const [row] = await db
    .insert(coverLetterVersionsTable)
    .values({
      jobId: job.id,
      label: `AI drafted — ${new Date().toLocaleDateString()}`,
      status: "pending_approval",
      claimIds: usedClaimIds,
      draftContent: fullText,
      annotatedParagraphs: paragraphs as unknown as Record<string, unknown>[],
      notes: `Subject: ${parsed?.subject ?? `Application for ${job.title} at ${job.company}`}`,
    })
    .returning();

  logger.info(
    { jobId: job.id, coverLetterVersionId: row!.id, paragraphs: paragraphs.length },
    "Cover letter draft pipeline completed",
  );

  return row!;
}
