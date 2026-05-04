import {
  db,
  coverLetterVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { callAI, parseJsonResponse } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { validateParagraph, assertMinimumContent, TruthLockViolation, stripClaimIdRefs, validateCoverLetterQuality, QualityViolation } from "./validation";
import { logger } from "../logger";
import { loadOrCreateBestPractices, formatBestPracticesForPrompt } from "../best-practices";
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
4. Do NOT include claim ID references (like "(ID:4)" or "[ID:14]") in the paragraph text body.
   Claim attribution goes ONLY in the "claimIds" array field, never in the prose.

RESUME CONTEXT — CRITICAL:
You are given the candidate's resume as background context. The cover letter should:
- COMPLEMENT the resume, not repeat it verbatim
- Highlight 2-3 key achievements from the resume that are MOST RELEVANT to this job
- Explain WHY the candidate is excited about THIS specific company and role
- Address any gaps between the resume and job requirements (use claims to bridge)
- Show personality and genuine enthusiasm
- Be 250-400 words (roughly 3-4 paragraphs)

QUALITY REQUIREMENTS:
- Address the company's specific business problem or opportunity
- Show you've researched the company (use company name, mission, recent news if known)
- Use the hiring manager's name if provided
- Include a clear call to action
- NO generic filler phrases like "I am writing to apply for", "I believe I am a good fit"
- NO markdown formatting — plain text only

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

  // Fetch base resume for context
  const [baseResumeVersion] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.isCurrent, true))
    .orderBy(desc(baseResumeVersionsTable.createdAt))
    .limit(1);

  const resumeContext = baseResumeVersion
    ? `\n\nCandidate's Resume (for context — do NOT repeat verbatim, use to complement):\n${baseResumeVersion.contentText.slice(0, 2000)}`
    : "";

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

  // Load best practices and inject into system prompt
  const bestPractices = await loadOrCreateBestPractices("general");
  const practicesText = formatBestPracticesForPrompt(bestPractices);
  const augmentedSystemPrompt = SYSTEM_PROMPT + practicesText;

  const MAX_RETRIES = 2;
  let attempt = 0;
  let lastQualityViolation: QualityViolation | null = null;
  let lastResult: Awaited<ReturnType<typeof callAI>> | null = null;
  let parsed: CoverLetterResult | null = null;
  let validatedParagraphs: NonNullable<ReturnType<typeof validateParagraph>>[] = [];
  let fullText = "";

  while (attempt <= MAX_RETRIES) {
    const correctionNote =
      lastQualityViolation && attempt > 0
        ? `\n\n[SELF-CORRECTION — attempt ${attempt + 1} of ${MAX_RETRIES + 1}]\nYour previous output failed quality validation:\n${lastQualityViolation.violations.map((v) => `- ${v}`).join("\n")}\nFix ALL of these issues and regenerate the complete output.`
        : "";

    lastResult = await callAI({
      taskType: "cover_letter",
      systemPrompt: augmentedSystemPrompt,
      userPrompt:
        `Draft a cover letter for this job:\n\n${jobContext}${resumeContext}\n\nAvailable claims (use ONLY these IDs):\n${claimsContext}` +
        correctionNote,
      jobId: job.id,
      modelOverride: options?.modelOverride,
    });

    parsed = parseJsonResponse<CoverLetterResult>(lastResult.content);

    if (!parsed || !Array.isArray(parsed.paragraphs)) {
      logger.error(
        { jobId: job.id, raw: lastResult.content.slice(0, 500) },
        "AI returned unparseable JSON for cover letter — storing failed version",
      );
      const [row] = await db
        .insert(coverLetterVersionsTable)
        .values({
          jobId: job.id,
          label: "AI drafted — generation failed",
          status: "pending_approval",
          runId: lastResult.runId,
          eventLogId: lastResult.eventLogId,
          claimIds: [],
          annotatedParagraphs: [],
          draftContent: lastResult.content,
          notes: "AI output could not be parsed as structured JSON. Review raw content and regenerate.",
        })
        .returning();
      return row!;
    }

    validatedParagraphs = parsed.paragraphs
      .map((p) => validateParagraph(p, selectedClaims))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    try {
      assertMinimumContent(validatedParagraphs, lastResult.content, "cover letter paragraphs");
    } catch (err) {
      if (err instanceof TruthLockViolation) {
        logger.error(
          { jobId: job.id, ...err.details },
          "Truth lock violation: zero valid paragraphs — storing failed version",
        );
        const [row] = await db
          .insert(coverLetterVersionsTable)
          .values({
            jobId: job.id,
            label: "AI drafted — truth lock failure",
            status: "pending_approval",
            runId: lastResult.runId,
            eventLogId: lastResult.eventLogId,
            claimIds: [],
            annotatedParagraphs: [],
            draftContent: lastResult.content,
            notes: `Truth lock failure: ${err.message}. All AI-generated paragraphs cited claim IDs not in the selected set. Review claims and regenerate.`,
          })
          .returning();
        return row!;
      }
      throw err;
    }

    // ─── Best Practices Quality Validation ───
    fullText = stripClaimIdRefs(
      parsed.fullText?.trim() ||
      validatedParagraphs.map((p) => p.text).join("\n\n"),
    );

    try {
      validateCoverLetterQuality(fullText);
      lastQualityViolation = null;
      break; // passed — exit retry loop
    } catch (err) {
      if (err instanceof QualityViolation) {
        lastQualityViolation = err;
        logger.warn(
          { jobId: job.id, attempt: attempt + 1, violations: err.violations },
          "Cover letter quality violation — retrying",
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
      "Cover letter quality validation failed after all retries — storing failed version",
    );
    const [row] = await db
      .insert(coverLetterVersionsTable)
      .values({
        jobId: job.id,
        label: "AI drafted — quality check failed",
        status: "pending_approval",
        runId: lastResult!.runId,
        eventLogId: lastResult!.eventLogId,
        claimIds: [...new Set(validatedParagraphs.flatMap((p) => p.claimIds))],
        annotatedParagraphs: validatedParagraphs as unknown as Record<string, unknown>[],
        draftContent: fullText,
        notes: `Quality check failed after ${MAX_RETRIES + 1} attempts:\n${lastQualityViolation.violations.join("\n")}\n\nThe AI output violated best practices. Review and regenerate, or adjust your claims.`,
      })
      .returning();
    return row!;
  }

  // At this point parsed and lastResult are guaranteed non-null (loop exited via break)
  const finalParsed = parsed!;
  const finalResult = lastResult!;

  const usedClaimIds = [...new Set(validatedParagraphs.flatMap((p) => p.claimIds))];
  const sanitizedParagraphs = validatedParagraphs.map((p) => ({
    ...p,
    text: stripClaimIdRefs(p.text),
  }));

  const [row] = await db
    .insert(coverLetterVersionsTable)
    .values({
      jobId: job.id,
      label: `AI drafted — ${new Date().toLocaleDateString()}`,
      status: "pending_approval",
      runId: finalResult.runId,
      eventLogId: finalResult.eventLogId,
      claimIds: usedClaimIds,
      draftContent: fullText,
      annotatedParagraphs: sanitizedParagraphs as unknown as Record<string, unknown>[],
      notes: `Subject: ${finalParsed.subject ?? `Application for ${job.title} at ${job.company}`}`,
    })
    .returning();

  logger.info(
    {
      jobId: job.id,
      coverLetterVersionId: row!.id,
      paragraphsGenerated: finalParsed.paragraphs?.length ?? 0,
      paragraphsValid: validatedParagraphs.length,
      discarded: (finalParsed.paragraphs?.length ?? 0) - validatedParagraphs.length,
    },
    "Cover letter draft pipeline completed",
  );

  return row!;
}
