import {
  db,
  coverLetterVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { callAI, parseJsonResponse } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { validateParagraph, assertMinimumContent, TruthLockViolation, stripClaimIdRefs, validateCoverLetterQuality, validateSemanticQuality, QualityViolation, reviewGeneratedTruth } from "./validation";
import { logger } from "../logger";
import { loadOrCreateBestPractices, formatBestPracticesForPrompt } from "../best-practices";
import type { Job, RoleProfile, Claim } from "@workspace/db";

interface RawParagraph {
  text?: unknown;
  claimIds?: unknown;
  role?: unknown;
  jobKeywordsUsed?: unknown;
  companySourcesUsed?: unknown;
  gapNotes?: unknown;
  sourceMap?: unknown;
}

interface CoverLetterResult {
  subject?: string;
  paragraphs?: RawParagraph[];
  fullText?: string;
}

function buildResearchPromptContext(researchData: unknown): string {
  if (
    !researchData ||
    typeof researchData !== "object" ||
    !("status" in researchData) ||
    (researchData as { status?: unknown }).status !== "verified"
  ) {
    return "";
  }

  return JSON.stringify(researchData).slice(0, 3000);
}

function extractAttemptSummary(error: unknown): string {
  if (!error || typeof error !== "object" || !("attemptErrors" in error)) {
    return "No model-attempt details were recorded.";
  }
  const attempts = (error as { attemptErrors?: unknown }).attemptErrors;
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return "No model-attempt details were recorded.";
  }
  return attempts
    .map((attempt) => {
      const modelName = typeof (attempt as { modelName?: unknown }).modelName === "string"
        ? (attempt as { modelName: string }).modelName
        : "unknown-model";
      const category = typeof (attempt as { category?: unknown }).category === "string"
        ? (attempt as { category: string }).category
        : "unknown";
      const detail = typeof (attempt as { error?: unknown }).error === "string"
        ? (attempt as { error: string }).error
        : "unknown error";
      return `${modelName}: ${category} (${detail})`;
    })
    .join(" | ");
}

const COVER_LETTER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "paragraphs", "fullText"],
  properties: {
    subject: { type: "string", minLength: 6, maxLength: 180 },
    fullText: { type: "string", minLength: 120, maxLength: 3000 },
    paragraphs: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "claimIds", "role", "jobKeywordsUsed", "companySourcesUsed", "gapNotes", "sourceMap"],
        properties: {
          text: { type: "string", minLength: 20, maxLength: 1200 },
          claimIds: { type: "array", maxItems: 8, items: { type: "number" } },
          role: { type: "string", enum: ["opening", "hook", "body", "closing"] },
          jobKeywordsUsed: { type: "array", maxItems: 15, items: { type: "string" } },
          companySourcesUsed: { type: "array", maxItems: 10, items: { type: "string" } },
          gapNotes: { type: "array", maxItems: 8, items: { type: "string" } },
          sourceMap: {
            type: "object",
            additionalProperties: false,
            required: ["supportedPhrases", "sourceClaimIds"],
            properties: {
              supportedPhrases: { type: "array", maxItems: 10, items: { type: "string" } },
              sourceClaimIds: { type: "array", maxItems: 8, items: { type: "number" } },
            },
          },
        },
      },
    },
  },
} as const;

const COVER_LETTER_STRUCTURED_OUTPUT_PARAMS = {
  temperature: 0.2,
  max_tokens: 3000,
  timeoutMs: 30_000,
  maxAttempts: 2,
  response_format: { type: "json_object" },
};

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
- Be 200-400 words (roughly 3-4 paragraphs)

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
      "role": "opening|hook|body|closing",
      "jobKeywordsUsed": ["exact JD keywords used in this paragraph"],
      "companySourcesUsed": ["company/job facts from the provided job description or stored research"],
      "gapNotes": ["unsupported requirement or company detail intentionally omitted"],
      "sourceMap": {
        "supportedPhrases": ["important phrase from the paragraph"],
        "sourceClaimIds": [claim_id_numbers]
      }
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
    userId?: number;
    modelOverride?: {
      provider?: string;
      modelName: string;
    };
  },
): Promise<typeof coverLetterVersionsTable.$inferSelect> {
  const userId = options?.userId ?? job.userId;
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
        userId,
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
    .where(and(eq(baseResumeVersionsTable.userId, userId), eq(baseResumeVersionsTable.isCurrent, true)));

  const resumeContext = baseResumeVersion
    ? `\n\nCandidate's Resume (for context — do NOT repeat verbatim, use to complement):\n${baseResumeVersion.contentText.slice(0, 2000)}`
    : "";

  const researchContext = buildResearchPromptContext(job.researchData);

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

  // Load task-specific best practices and inject into system prompt
  const bestPractices = await loadOrCreateBestPractices("cover_letter");
  const practicesText = formatBestPracticesForPrompt(bestPractices);
  const augmentedSystemPrompt = SYSTEM_PROMPT + practicesText + `\n\nTRUTH-LOCK SOURCE POLICY:
- Treat the provided claims, candidate resume context, job description fields, and stored job research as the ONLY factual sources.
- Do not use model memory for company news, mission, products, people, or recent events.
- If stored job research is unavailable or unverified, treat it as absent and do not cite company-specific research claims.
- You may write in a natural human voice, but you may not invent motivations, relationships, metrics, credentials, dates, titles, tools, company facts, or experience.
- Body and hook paragraphs must cite claimIds. Opening and closing may be uncited only if they contain no factual claims.`;

  let aiResult: Awaited<ReturnType<typeof callAI>>;

  try {
    aiResult = await callAI({
      taskType: "cover_letter",
      systemPrompt: augmentedSystemPrompt,
      userPrompt:
        `Draft a cover letter for this job:\n\n${jobContext}${resumeContext}\n\nStored job/company research (use only if present; do not use model memory):\n${researchContext || "No stored research available."}\n\nAvailable claims (use ONLY these IDs):\n${claimsContext}`,
      jobId: job.id,
      userId,
      modelOverride: options?.modelOverride,
      extraParams: COVER_LETTER_STRUCTURED_OUTPUT_PARAMS,
      validateContent: (content) => {
        const parsedCandidate = parseJsonResponse<CoverLetterResult>(content);
        if (!parsedCandidate || !Array.isArray(parsedCandidate.paragraphs) || parsedCandidate.paragraphs.length === 0) {
          throw new Error("Cover letter did not pass structured JSON validation.");
        }
      },
    });
  } catch (error) {
    const [row] = await db
      .insert(coverLetterVersionsTable)
      .values({
        userId,
        jobId: job.id,
        label: "AI drafted — generation failed",
        status: "pending_approval",
        runId:
          error && typeof error === "object" && "runId" in error && typeof (error as { runId?: unknown }).runId === "string"
            ? (error as { runId: string }).runId
            : null,
        eventLogId:
          error && typeof error === "object" && "eventLogId" in error && typeof (error as { eventLogId?: unknown }).eventLogId === "number"
            ? (error as { eventLogId: number }).eventLogId
            : null,
        claimIds: selectedClaims.map((claim) => claim.id),
        annotatedParagraphs: [],
        draftContent: "",
        notes: `Cover letter generation failed after model fallback attempts. ${extractAttemptSummary(error)}`,
      })
      .returning();
    return row!;
  }

  const parsed = parseJsonResponse<CoverLetterResult>(aiResult.content);

  if (!parsed || !Array.isArray(parsed.paragraphs)) {
    logger.error(
      { jobId: job.id, raw: aiResult.content.slice(0, 500) },
      "AI returned unparseable JSON for cover letter — storing failed version",
    );
    const [row] = await db
      .insert(coverLetterVersionsTable)
      .values({
        userId,
        jobId: job.id,
        label: "AI drafted — generation failed",
        status: "pending_approval",
        runId: aiResult.runId,
        eventLogId: aiResult.eventLogId,
        claimIds: [],
        annotatedParagraphs: [],
        draftContent: aiResult.content,
        notes: "AI output could not be parsed as structured JSON. Review raw content and regenerate.",
      })
      .returning();
    return row!;
  }

  const validatedParagraphs = parsed.paragraphs
    .map((p) => validateParagraph(p, selectedClaims))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  try {
    assertMinimumContent(validatedParagraphs, aiResult.content, "cover letter paragraphs");
  } catch (err) {
    if (err instanceof TruthLockViolation) {
      logger.error(
        { jobId: job.id, ...err.details },
        "Truth lock violation: zero valid paragraphs — storing failed version",
      );
      const [row] = await db
        .insert(coverLetterVersionsTable)
        .values({
          userId,
          jobId: job.id,
          label: "AI drafted — truth lock failure",
          status: "pending_approval",
          runId: aiResult.runId,
          eventLogId: aiResult.eventLogId,
          claimIds: [],
          annotatedParagraphs: [],
          draftContent: aiResult.content,
          notes: `Truth lock failure: ${err.message}. All AI-generated paragraphs cited claim IDs not in the selected set. Review claims and regenerate.`,
        })
        .returning();
      return row!;
    }
    throw err;
  }

  // ─── Best Practices Quality Validation ───
  const fullText = stripClaimIdRefs(
    parsed.fullText?.trim() ||
    validatedParagraphs.map((p) => p.text).join("\n\n"),
  );

  let qualityViolation: QualityViolation | null = null;
  try {
    validateCoverLetterQuality(fullText);
    await validateSemanticQuality(fullText, jobContext, job.id, userId);
  } catch (err) {
    if (err instanceof QualityViolation) {
      qualityViolation = err;
      logger.warn(
        { jobId: job.id, violations: err.violations },
        "Cover letter quality violation — storing draft for review",
      );
    } else {
      throw err;
    }
  }

  if (qualityViolation) {
    logger.error(
      { jobId: job.id, violations: qualityViolation.violations },
      "Cover letter quality validation failed — storing version for review",
    );
    const [row] = await db
      .insert(coverLetterVersionsTable)
      .values({
        userId,
        jobId: job.id,
        label: "AI drafted — quality check failed",
        status: "pending_approval",
        runId: aiResult.runId,
        eventLogId: aiResult.eventLogId,
        claimIds: [...new Set(validatedParagraphs.flatMap((p) => p.claimIds))],
        annotatedParagraphs: validatedParagraphs as unknown as Record<string, unknown>[],
        draftContent: fullText,
        notes: `Quality check failed:\n${qualityViolation.violations.join("\n")}\n\nThe AI output violated best practices. Review and regenerate, or adjust your claims.`,
      })
      .returning();
    return row!;
  }

  const finalParsed = parsed;
  const finalResult = aiResult;

  const usedClaimIds = [...new Set(validatedParagraphs.flatMap((p) => p.claimIds))];
  const truthReview = reviewGeneratedTruth(validatedParagraphs, {
    selectedClaims,
    baseResumeText: baseResumeVersion?.contentText ?? "",
    jobSourceText: jobContext,
    researchSourceText: researchContext,
    allowUncitedRoles: ["opening", "closing"],
    sourcePolicy:
      "Cover letter facts must be traceable to the Claims Ledger, base resume, job description, or stored job research. Company references cannot come from model memory.",
  });

  const enrichedParagraphs = validatedParagraphs.map((paragraph, index) => ({
    ...paragraph,
    truthReview: truthReview.items[index] ?? null,
    supportStatus: truthReview.items[index]?.supportStatus ?? "partial",
  }));

  const sanitizedParagraphs = enrichedParagraphs.map((p) => ({
    ...p,
    text: stripClaimIdRefs(p.text),
  }));

  if (truthReview.seriousViolationCount > 0) {
    logger.error(
      { jobId: job.id, truthReview },
      "Cover letter truth review failed â€” storing pending diagnostic version",
    );
    const [row] = await db
      .insert(coverLetterVersionsTable)
      .values({
        userId,
        jobId: job.id,
        label: "AI drafted â€” truth review failed",
        status: "pending_approval",
        runId: finalResult.runId,
        eventLogId: finalResult.eventLogId,
        claimIds: usedClaimIds,
        draftContent: fullText,
        annotatedParagraphs: sanitizedParagraphs as unknown as Record<string, unknown>[],
        notes:
          `Truth review failed with ${truthReview.seriousViolationCount} serious issue(s). ` +
          `Subject: ${finalParsed.subject ?? `Application for ${job.title} at ${job.company}`}`,
      })
      .returning();
    return row!;
  }

  const [row] = await db
    .insert(coverLetterVersionsTable)
    .values({
      userId,
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
