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
import { loadOrCreateBestPractices, formatBestPracticesForPrompt } from "../best-practices";
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

CRITICAL RULES — NEVER VIOLATE:
1. Every bullet MUST trace back to a provided claim. Do NOT invent new achievements.
2. Use ONLY claim IDs from the provided list. Do NOT use any other IDs.
3. Bullets that combine multiple claims must explicitly flag isAggregated: true.
4. Use strong action verbs and quantifiable language where supported by claims.
5. Match the job's required skills and keywords where truthfully supported by claims.
6. Do NOT include claim ID references (like "(ID:4)" or "[ID:14]") in the text (bullets or documentText).
   Claim attribution goes ONLY in the "claimIds" array field of the bullets, never in the prose.
7. Return a complete resume draft in plain text with section headings and bullets.

COMPARISON INSTRUCTION — CRITICAL:
You are given BOTH the candidate's current resume AND the job description. Your task is to:
- Identify which skills and experiences on the resume DIRECTLY MATCH the job requirements
- Identify which job requirements are GAPS (not explicitly on the resume)
- For gaps, use claims to bridge them with transferable skills or relevant experience
- REORDER and REPHRASE bullets to put the most relevant qualifications FIRST
- Use the job's exact keywords where supported by claims (ATS optimization)
- The tailored resume should read as if the candidate is a PERFECT MATCH for this specific job

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

  // Load best practices and inject into system prompt
  const bestPractices = await loadOrCreateBestPractices("general");
  const practicesText = formatBestPracticesForPrompt(bestPractices);
  const augmentedSystemPrompt = SYSTEM_PROMPT + practicesText;

  const MAX_RETRIES = 2;
  let attempt = 0;
  let lastQualityViolation: QualityViolation | null = null;
  let lastResult: Awaited<ReturnType<typeof callAI>> | null = null;
  let parsed: TailoringResult | null = null;
  let validatedBullets: NonNullable<ReturnType<typeof validateBullet>>[] = [];

  while (attempt <= MAX_RETRIES) {
    const correctionNote =
      lastQualityViolation && attempt > 0
        ? `\n\n[SELF-CORRECTION — attempt ${attempt + 1} of ${MAX_RETRIES + 1}]\nYour previous output failed quality validation:\n${lastQualityViolation.violations.map((v) => `- ${v}`).join("\n")}\nFix ALL of these issues and regenerate the complete output.`
        : "";

    lastResult = await callAI({
      taskType: "resume_tailoring",
      systemPrompt: augmentedSystemPrompt,
      userPrompt:
        `Tailor the base resume for this job.\n\n` +
        `Base Resume (current source of truth):\n${baseResumeVersion.contentText}\n\n` +
        `${jobContext}\n\nAvailable claims (use ONLY these):\n${claimsContext}` +
        correctionNote,
      jobId: job.id,
      modelOverride: options?.modelOverride,
    });

    parsed = parseJsonResponse<TailoringResult>(lastResult.content);

    if (
      !parsed ||
      typeof parsed.documentText !== "string" ||
      parsed.documentText.trim() === "" ||
      !Array.isArray(parsed.bullets)
    ) {
      logger.error(
        { jobId: job.id, raw: lastResult.content.slice(0, 500) },
        "AI returned unparseable JSON for resume tailoring — storing failed version",
      );
      const [row] = await db
        .insert(resumeVersionsTable)
        .values({
          jobId: job.id,
          label: "AI tailored — generation failed",
          status: "pending_approval",
          baseResumeVersionId: baseResumeVersion.id,
          runId: lastResult.runId,
          eventLogId: lastResult.eventLogId,
          claimIds: [],
          tailoredBullets: [],
          tailoredDocumentText: null,
          rawContent: lastResult.content,
          notes: "AI output could not be parsed as structured JSON. Review raw content and regenerate.",
        })
        .returning();
      return row!;
    }

    validatedBullets = parsed.bullets
      .map((b) => validateBullet(b, selectedClaims))
      .filter((b): b is NonNullable<typeof b> => b !== null);

    try {
      assertMinimumContent(validatedBullets, lastResult.content, "resume bullets");
    } catch (err) {
      if (err instanceof TruthLockViolation) {
        logger.error(
          { jobId: job.id, ...err.details },
          "Truth lock violation: zero valid bullets — storing failed version",
        );
        const [row] = await db
          .insert(resumeVersionsTable)
          .values({
            jobId: job.id,
            label: "AI tailored — truth lock failure",
            status: "pending_approval",
            baseResumeVersionId: baseResumeVersion.id,
            runId: lastResult.runId,
            eventLogId: lastResult.eventLogId,
            claimIds: [],
            tailoredBullets: [],
            tailoredDocumentText: parsed.documentText as string,
            rawContent: lastResult.content,
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
      lastQualityViolation = null;
      break; // passed — exit retry loop
    } catch (err) {
      if (err instanceof QualityViolation) {
        lastQualityViolation = err;
        logger.warn(
          { jobId: job.id, attempt: attempt + 1, violations: err.violations },
          "Resume quality violation — retrying",
        );
        attempt++;
      } else {
        throw err;
      }
    }
  }

  // After retry loop: if still failing quality, store failed record
  if (lastQualityViolation) {
    logger.error(
      { jobId: job.id, violations: lastQualityViolation.violations },
      "Resume quality validation failed after all retries — storing failed version",
    );
    const [row] = await db
      .insert(resumeVersionsTable)
      .values({
        jobId: job.id,
        label: "AI tailored — quality check failed",
        status: "pending_approval",
        baseResumeVersionId: baseResumeVersion.id,
        runId: lastResult!.runId,
        eventLogId: lastResult!.eventLogId,
        claimIds: [...new Set(validatedBullets.flatMap((b) => b.claimIds))],
        tailoredBullets: validatedBullets as unknown as Record<string, unknown>[],
        tailoredDocumentText: parsed!.documentText as string,
        rawContent: lastResult!.content,
        notes: `Quality check failed after ${MAX_RETRIES + 1} attempts:\n${lastQualityViolation.violations.join("\n")}\n\nThe AI output violated best practices. Review and regenerate, or adjust your claims.`,
      })
      .returning();
    return row!;
  }

  // At this point parsed and lastResult are guaranteed non-null (loop exited via break after passing quality check)
  const finalParsed = parsed!;
  const finalResult = lastResult!;

  const usedClaimIds = [...new Set(validatedBullets.flatMap((b) => b.claimIds))];
  const diffData = {
    addedBullets: finalParsed.addedBullets ?? [],
    removedBullets: finalParsed.removedBullets ?? [],
    reorderedSections: finalParsed.reorderedSections ?? [],
    summary: finalParsed.summary ?? "",
    generatedAt: new Date().toISOString(),
    modelName: finalResult.modelName,
    bulletsTotal: finalParsed.bullets?.length ?? 0,
    bulletsPassedValidation: validatedBullets.length,
    bulletsDiscarded: (finalParsed.bullets?.length ?? 0) - validatedBullets.length,
  };

  const sanitizedBullets = validatedBullets.map((b) => ({
    ...b,
    text: stripClaimIdRefs(b.text),
  }));

  const sanitizedDocumentText = stripClaimIdRefs(finalParsed.documentText as string);

  const [row] = await db
    .insert(resumeVersionsTable)
    .values({
      jobId: job.id,
      label: `AI tailored — ${new Date().toLocaleDateString()}`,
      status: "pending_approval",
      baseResumeVersionId: baseResumeVersion.id,
      runId: finalResult.runId,
      eventLogId: finalResult.eventLogId,
      claimIds: usedClaimIds,
      tailoredDocumentText: sanitizedDocumentText,
      tailoredBullets: sanitizedBullets as unknown as Record<string, unknown>[],
      diffData: diffData as unknown as Record<string, unknown>,
      notes: finalParsed.summary ?? "AI-generated resume tailoring",
    })
    .returning();

  logger.info(
    {
      jobId: job.id,
      resumeVersionId: row!.id,
      bulletsGenerated: finalParsed.bullets?.length ?? 0,
      bulletsValid: validatedBullets.length,
      discarded: (finalParsed.bullets?.length ?? 0) - validatedBullets.length,
    },
    "Resume tailor pipeline completed",
  );

  return row!;
}
