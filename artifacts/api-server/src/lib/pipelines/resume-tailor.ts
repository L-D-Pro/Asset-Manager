import {
  db,
  resumeVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAI, parseJsonResponse } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { validateBullet, assertMinimumContent, TruthLockViolation, stripClaimIdRefs, validateResumeQuality, QualityViolation } from "./validation";
import { logger } from "../logger";
import type { Job, Claim } from "@workspace/db";

interface RawBullet {
  text?: unknown;
  claimIds?: unknown;
  section?: unknown;
  isAggregated?: unknown;
  originalText?: unknown;
}

interface TailoringResult {
  documentText?: unknown;
  bullets?: RawBullet[];
  addedBullets?: string[];
  removedBullets?: string[];
  reorderedSections?: string[];
  summary?: string;
}

export class MissingBaseResumeError extends Error {
  constructor() {
    super("Base resume is required before tailoring. Save your current resume first.");
    this.name = "MissingBaseResumeError";
  }
}

const SYSTEM_PROMPT = `You are an expert resume writer and career coach specializing in ATS-optimized resumes.
Your task is to tailor a full plain-text resume draft to a specific job, using the provided base resume as structure and ONLY the provided claims as new factual source material.

CRITICAL FORMATTING RULES — NEVER VIOLATE:
1. Output MUST be plain text only. NO markdown formatting: no **bold**, no *italic*, no # headers, no bullet points (• or -), no code blocks.
2. Every bullet MUST trace back to a provided claim. Do NOT invent new achievements.
3. Use ONLY claim IDs from the provided list. Do NOT use any other IDs.
4. Bullets that combine multiple claims must explicitly flag isAggregated: true.
5. Use strong action verbs and quantifiable language where supported by claims.
6. Match the job's required skills and keywords where truthfully supported by claims.
7. Do NOT include claim ID references (like "(ID:4)" or "[ID:14]") in the text (bullets or documentText).
   Claim attribution goes ONLY in the "claimIds" array field of the bullets, never in the prose.
8. Return a complete resume draft in plain text with section headings and bullets.

QUALITY REQUIREMENTS:
- Tailor to THIS specific job: Reference the job title, company name, and key requirements naturally in the content.
- Quantified impact: Every bullet must include at least one number, percentage, dollar amount, or measurable outcome.
- No generic filler: Remove phrases like "team player", "detail-oriented", "hard worker", "passionate about".
- Replace with specific achievements from claims.

Return ONLY valid JSON with this exact structure:
{
  "documentText": "Full tailored resume draft in plain text",
  "bullets": [
    {
      "text": "Tailored bullet text",
      "claimIds": [claim_id_numbers],
      "section": "experience|skills|projects|education|summary",
      "isAggregated": false,
      "originalText": "original claim summary or null"
    }
  ],
  "addedBullets": ["new bullet texts not in original"],
  "removedBullets": ["removed bullet texts"],
  "reorderedSections": ["sections that moved"],
  "summary": "Brief explanation of tailoring decisions"
}`;

/**
 * Runs the resume tailoring pipeline:
 * 1. Matches claims to the job (or uses provided claimIds)
 * 2. Calls the AI to generate tailored bullets with claim attribution
 * 3. Validates all returned claim IDs against the selected claims (truth lock)
 * 4. Discards bullets with no valid claim attribution
 * 5. Fails hard if zero valid bullets remain (stores raw output for debugging)
 * 6. Stores the result as a new ResumeVersion in pending_approval state
 * Returns the new ResumeVersion.
 */
export async function runResumeTailorPipeline(
  job: Job,
  allClaims: Claim[],
  claimIds?: number[],
  options?: {
    modelOverride?: {
      provider?: string;
      modelName: string;
    };
  },
): Promise<typeof resumeVersionsTable.$inferSelect> {
  logger.info({ jobId: job.id, claimIds }, "Starting resume tailor pipeline");

  const [baseResumeVersion] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.isCurrent, true));

  if (!baseResumeVersion) {
    throw new MissingBaseResumeError();
  }

  let selectedClaims: Claim[];
  if (claimIds && claimIds.length > 0) {
    selectedClaims = allClaims.filter((c) => claimIds.includes(c.id));
  } else {
    const matches = matchClaimsToJob(job, allClaims);
    selectedClaims = matches.slice(0, 15).map((m) => m.claim);
  }

  if (selectedClaims.length === 0) {
    logger.warn({ jobId: job.id }, "No claims available for resume tailoring");
    const [row] = await db
      .insert(resumeVersionsTable)
      .values({
        jobId: job.id,
        label: "AI tailored — no claims available",
        status: "pending_approval",
        baseResumeVersionId: baseResumeVersion.id,
        tailoredDocumentText: baseResumeVersion.contentText,
        claimIds: [],
        notes: "No matching claims found. Add claims to your Claims Ledger first.",
        tailoredBullets: [],
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

  const jobContext = `
Title: ${job.title}
Company: ${job.company}
Required Skills: ${(job.parsedRequiredSkills ?? []).join(", ") || "Not parsed yet"}
Nice-to-Have Skills: ${(job.parsedNiceToHaveSkills ?? []).join(", ") || ""}
Keywords: ${(job.parsedKeywords ?? []).join(", ") || ""}
Responsibilities: ${(job.parsedResponsibilities ?? []).join("; ") || "Not parsed yet"}
`.trim();

  const result = await callAI({
    taskType: "resume_tailoring",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt:
      `Tailor the base resume for this job.\n\n` +
      `Base Resume (current source of truth):\n${baseResumeVersion.contentText}\n\n` +
      `${jobContext}\n\nAvailable claims (use ONLY these):\n${claimsContext}`,
    jobId: job.id,
    modelOverride: options?.modelOverride,
  });

  const parsed = parseJsonResponse<TailoringResult>(result.content);

  if (
    !parsed ||
    typeof parsed.documentText !== "string" ||
    parsed.documentText.trim() === "" ||
    !Array.isArray(parsed.bullets)
  ) {
    logger.error(
      { jobId: job.id, raw: result.content.slice(0, 500) },
      "AI returned unparseable JSON for resume tailoring — storing failed version",
    );
    const [row] = await db
      .insert(resumeVersionsTable)
      .values({
        jobId: job.id,
        label: "AI tailored — generation failed",
        status: "pending_approval",
        baseResumeVersionId: baseResumeVersion.id,
        runId: result.runId,
        eventLogId: result.eventLogId,
        claimIds: [],
        tailoredBullets: [],
        tailoredDocumentText: null,
        rawContent: result.content,
        notes: "AI output could not be parsed as structured JSON. Review raw content and regenerate.",
      })
      .returning();
    return row!;
  }

  const validatedBullets = parsed.bullets
    .map((b) => validateBullet(b, selectedClaims))
    .filter((b): b is NonNullable<typeof b> => b !== null);

  try {
    assertMinimumContent(validatedBullets, result.content, "resume bullets");
  } catch (err) {
    if (err instanceof TruthLockViolation) {
      logger.error(
        { jobId: job.id, ...err.details },
        "Truth lock violation: zero valid bullets after validation — storing failed version",
      );
      const [row] = await db
        .insert(resumeVersionsTable)
        .values({
          jobId: job.id,
          label: "AI tailored — truth lock failure",
          status: "pending_approval",
          baseResumeVersionId: baseResumeVersion.id,
          runId: result.runId,
          eventLogId: result.eventLogId,
          claimIds: [],
          tailoredBullets: [],
          tailoredDocumentText: parsed.documentText,
          rawContent: result.content,
          notes: `Truth lock failure: ${err.message}. All AI-generated bullets cited claim IDs not in the selected set. Review claims and regenerate.`,
        })
        .returning();
      return row!;
    }
    throw err;
  }

  // ─── Best Practices Quality Validation ───
  try {
    validateResumeQuality(parsed.documentText as string, validatedBullets);
  } catch (err) {
    if (err instanceof QualityViolation) {
      logger.error(
        { jobId: job.id, violations: err.violations },
        "Quality violation in resume output — storing failed version",
      );
      const [row] = await db
        .insert(resumeVersionsTable)
        .values({
          jobId: job.id,
          label: "AI tailored — quality check failed",
          status: "pending_approval",
          baseResumeVersionId: baseResumeVersion.id,
          runId: result.runId,
          eventLogId: result.eventLogId,
          claimIds: [...new Set(validatedBullets.flatMap((b) => b.claimIds))],
          tailoredBullets: validatedBullets as unknown as Record<string, unknown>[],
          tailoredDocumentText: parsed.documentText as string,
          rawContent: result.content,
          notes: `Quality check failed:\n${err.violations.join("\n")}\n\nThe AI output violated best practices. Review and regenerate, or adjust your claims to include more quantified achievements.`,
        })
        .returning();
      return row!;
    }
    throw err;
  }

  const usedClaimIds = [...new Set(validatedBullets.flatMap((b) => b.claimIds))];
  const diffData = {
    addedBullets: parsed.addedBullets ?? [],
    removedBullets: parsed.removedBullets ?? [],
    reorderedSections: parsed.reorderedSections ?? [],
    summary: parsed.summary ?? "",
    generatedAt: new Date().toISOString(),
    modelName: result.modelName,
    bulletsTotal: parsed.bullets.length,
    bulletsPassedValidation: validatedBullets.length,
    bulletsDiscarded: parsed.bullets.length - validatedBullets.length,
  };

  const sanitizedBullets = validatedBullets.map((b) => ({
    ...b,
    text: stripClaimIdRefs(b.text),
  }));

  const sanitizedDocumentText = stripClaimIdRefs(parsed.documentText as string);

  const [row] = await db
    .insert(resumeVersionsTable)
    .values({
      jobId: job.id,
      label: `AI tailored — ${new Date().toLocaleDateString()}`,
      status: "pending_approval",
      baseResumeVersionId: baseResumeVersion.id,
      runId: result.runId,
      eventLogId: result.eventLogId,
      claimIds: usedClaimIds,
      tailoredDocumentText: sanitizedDocumentText,
      tailoredBullets: sanitizedBullets as unknown as Record<string, unknown>[],
      diffData: diffData as unknown as Record<string, unknown>,
      notes: parsed.summary ?? "AI-generated resume tailoring",
    })
    .returning();

  logger.info(
    {
      jobId: job.id,
      resumeVersionId: row!.id,
      bulletsGenerated: parsed.bullets.length,
      bulletsValid: validatedBullets.length,
      discarded: parsed.bullets.length - validatedBullets.length,
    },
    "Resume tailor pipeline completed",
  );

  return row!;
}
