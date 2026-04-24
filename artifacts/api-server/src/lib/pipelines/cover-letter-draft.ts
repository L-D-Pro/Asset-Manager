import { db, coverLetterVersionsTable } from "@workspace/db";
import { callAI, parseJsonResponse } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { validateParagraph, assertMinimumContent, TruthLockViolation } from "./validation";
import { logger } from "../logger";
import type { Job, RoleProfile, Claim } from "@workspace/db";

interface RawParagraph {
  text?: unknown;
  claimIds?: unknown;
  role?: unknown;
}

interface CoverLetterResult {
  subject?: string;
  paragraphs?: RawParagraph[];
  fullText?: string;
}

const SYSTEM_PROMPT = `You are an expert career coach specializing in cover letters.
Your task is to draft a professional cover letter using ONLY the provided claims as source material.
CRITICAL RULES — NEVER VIOLATE:
1. Every body/hook paragraph MUST cite at least one claim ID from the provided list.
2. Use ONLY claim IDs from the provided list. Do NOT use any other IDs.
3. Do NOT invent achievements, metrics, or experiences not in the claims.
4. The letter should be authentic, concise (3-4 paragraphs), and tailored to the specific role.

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
 * 3. Validates all returned claim IDs against the selected claims (truth lock)
 * 4. Discards body/hook paragraphs with no valid claim attribution
 * 5. Fails hard if zero valid paragraphs remain (stores raw output for debugging)
 * 6. Stores the result as a new CoverLetterVersion in pending_approval state
 * Returns the new CoverLetterVersion.
 */
export async function runCoverLetterPipeline(
  job: Job,
  roleProfile: RoleProfile | null,
  allClaims: Claim[],
  claimIds?: number[],
  options?: {
    modelOverride?: {
      provider?: string;
      modelName: string;
    };
  },
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
    userPrompt: `Draft a cover letter for this job:\n\n${jobContext}\n\nAvailable claims (use ONLY these IDs):\n${claimsContext}`,
    jobId: job.id,
    modelOverride: options?.modelOverride,
  });

  const parsed = parseJsonResponse<CoverLetterResult>(result.content);

  if (!parsed || !Array.isArray(parsed.paragraphs)) {
    logger.error(
      { jobId: job.id, raw: result.content.slice(0, 500) },
      "AI returned unparseable JSON for cover letter — storing failed version",
    );
    const [row] = await db
      .insert(coverLetterVersionsTable)
      .values({
        jobId: job.id,
        label: "AI drafted — generation failed",
        status: "pending_approval",
        runId: result.runId,
        eventLogId: result.eventLogId,
        claimIds: [],
        annotatedParagraphs: [],
        draftContent: result.content,
        notes: "AI output could not be parsed as structured JSON. Review raw content and regenerate.",
      })
      .returning();
    return row!;
  }

  const validatedParagraphs = parsed.paragraphs
    .map((p) => validateParagraph(p, selectedClaims))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  try {
    assertMinimumContent(validatedParagraphs, result.content, "cover letter paragraphs");
  } catch (err) {
    if (err instanceof TruthLockViolation) {
      logger.error(
        { jobId: job.id, ...err.details },
        "Truth lock violation: zero valid paragraphs after validation — storing failed version",
      );
      const [row] = await db
        .insert(coverLetterVersionsTable)
        .values({
          jobId: job.id,
          label: "AI drafted — truth lock failure",
          status: "pending_approval",
          runId: result.runId,
          eventLogId: result.eventLogId,
          claimIds: [],
          annotatedParagraphs: [],
          draftContent: result.content,
          notes: `Truth lock failure: ${err.message}. All AI-generated paragraphs cited claim IDs not in the selected set. Review claims and regenerate.`,
        })
        .returning();
      return row!;
    }
    throw err;
  }

  const usedClaimIds = [...new Set(validatedParagraphs.flatMap((p) => p.claimIds))];
  const fullText = parsed.fullText?.trim() ||
    validatedParagraphs.map((p) => p.text).join("\n\n");

  const [row] = await db
    .insert(coverLetterVersionsTable)
    .values({
      jobId: job.id,
      label: `AI drafted — ${new Date().toLocaleDateString()}`,
      status: "pending_approval",
      runId: result.runId,
      eventLogId: result.eventLogId,
      claimIds: usedClaimIds,
      draftContent: fullText,
      annotatedParagraphs: validatedParagraphs as unknown as Record<string, unknown>[],
      notes: `Subject: ${parsed.subject ?? `Application for ${job.title} at ${job.company}`}`,
    })
    .returning();

  logger.info(
    {
      jobId: job.id,
      coverLetterVersionId: row!.id,
      paragraphsGenerated: parsed.paragraphs.length,
      paragraphsValid: validatedParagraphs.length,
      discarded: parsed.paragraphs.length - validatedParagraphs.length,
    },
    "Cover letter draft pipeline completed",
  );

  return row!;
}
