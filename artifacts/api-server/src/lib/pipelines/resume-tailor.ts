import {
  db,
  resumeVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { callAI } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { logger } from "../logger";
import {
  loadOrCreateBestPractices,
  formatBestPracticesForPrompt,
} from "../best-practices";
import {
  formatTemplatePrompt,
  getResumeTemplate,
  renderResumePlainText,
} from "../resume-templates";
import {
  buildResumeSourcePacket,
  formatResumeSourcePacketForPrompt,
  parsePlainTextResumeDraft,
} from "../resume-source-packet";
import { reviewFacts } from "./fact-review";
import {
  assertMinimumContent,
  QualityViolation,
  reviewGeneratedTruth,
  TruthLockViolation,
  validateResumeQuality,
  validateSemanticQuality,
} from "./validation";
import type { Job, Claim } from "@workspace/db";

const RESUME_OUTPUT_PARAMS = {
  temperature: 0.5,
  max_tokens: 4000,
  timeoutMs: 45_000,
  maxAttempts: 2,
};

export class MissingBaseResumeError extends Error {
  constructor() {
    super(
      "Base resume is required before tailoring. Save your current resume first.",
    );
    this.name = "MissingBaseResumeError";
  }
}

const SYSTEM_PROMPT = `You are an expert ATS resume writer.

Tailor the candidate's base resume to the target job using their approved Claims as the strongest evidence. Produce a complete, ready-to-submit plain-text resume.

Rules:
- Use only facts present in the base resume or claims. Do not invent companies, titles, dates, metrics, or technologies.
- Reorder, rephrase, emphasize, and prune freely - that is the tailoring.
- Match the job's required-skill vocabulary where it accurately reflects the candidate's experience.
- Keep the original company names and date ranges from the base resume.
- Plain text only. No markdown, no JSON, no preamble, no commentary - just the resume.
- Every substantive resume line must end with one or more source tags in this exact format: [src:claim:12] or [src:base:experience:b003]
- Use only source refs provided in the source packet. If a line combines multiple supported facts, include multiple source tags on that line.
- Do not add source tags to section headings or contact/header lines.`;

function buildJobContext(job: Job): string {
  return [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : "",
    job.remoteType ? `Remote: ${job.remoteType}` : "",
    job.parsedRequiredSkills?.length
      ? `Required skills: ${job.parsedRequiredSkills.join(", ")}`
      : "",
    job.parsedNiceToHaveSkills?.length
      ? `Nice to have: ${job.parsedNiceToHaveSkills.join(", ")}`
      : "",
    job.rawJdText ? `Full JD:\n${job.rawJdText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(args: {
  jobContext: string;
  baseResumeText: string;
  claims: Claim[];
  templateGuidance: string;
  sourcePacketGuidance: string;
}): string {
  const claimsBlock =
    args.claims.length === 0
      ? "(no claims selected - rely on the base resume)"
      : args.claims
          .map(
            (c, i) =>
              `${i + 1}. ${c.summary}${c.evidence ? ` - evidence: ${c.evidence}` : ""}`,
          )
          .join("\n");

  return [
    "TARGET JOB",
    args.jobContext,
    "",
    "BASE RESUME",
    args.baseResumeText,
    "",
    "APPROVED CLAIMS",
    claimsBlock,
    "",
    "FORMAT GUIDANCE",
    args.templateGuidance,
    "",
    "SOURCE PACKET",
    args.sourcePacketGuidance,
    "",
    "Now write the tailored resume.",
  ].join("\n");
}

async function insertDiagnosticResumeVersion(args: {
  userId: number;
  jobId: number;
  baseResumeVersionId: number | null;
  templateId: string;
  claimIds: number[];
  label: string;
  tailoredDocumentText: string;
  rawContent: string | null;
  runId: string | null | undefined;
  eventLogId: number | null | undefined;
  notes: string;
  diffData: Record<string, unknown>;
  tailoredBullets?: unknown[];
}): Promise<typeof resumeVersionsTable.$inferSelect> {
  const [row] = await db
    .insert(resumeVersionsTable)
    .values({
      userId: args.userId,
      jobId: args.jobId,
      label: args.label,
      status: "pending_approval",
      baseResumeVersionId: args.baseResumeVersionId,
      templateId: args.templateId,
      runId: args.runId ?? null,
      eventLogId: args.eventLogId ?? null,
      claimIds: args.claimIds,
      tailoredBullets: args.tailoredBullets ?? [],
      tailoredDocumentText: args.tailoredDocumentText,
      rawContent: args.rawContent,
      diffData: args.diffData,
      notes: args.notes,
    })
    .returning();

  return row!;
}

/**
 * Runs the resume tailoring pipeline:
 * 1. Loads the current base resume.
 * 2. Resolves selected claims (either explicit IDs or top-15 by relevance match).
 * 3. Makes one AI call to produce a source-tagged plain-text tailored resume.
 * 4. Parses and validates structured bullets from the tagged draft.
 * 5. Renders the canonical plain-text artifact plus approval metadata.
 * 6. Stores diagnostic drafts when truth, source, or semantic validation fails.
 */
export async function runResumeTailorPipeline(
  job: Job,
  allClaims: Claim[],
  claimIds?: number[],
  options?: {
    userId?: number;
    modelOverride?: { provider?: string; modelName: string };
    templateId?: string | null;
  },
): Promise<typeof resumeVersionsTable.$inferSelect> {
  const userId = options?.userId ?? job.userId;
  logger.info(
    { jobId: job.id, claimIds },
    "Starting resume tailor pipeline",
  );

  const [baseResumeVersion] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(
      and(
        eq(baseResumeVersionsTable.userId, userId),
        eq(baseResumeVersionsTable.isCurrent, true),
      ),
    );
  if (!baseResumeVersion) throw new MissingBaseResumeError();

  const template = getResumeTemplate(options?.templateId);
  const selectedClaims =
    claimIds && claimIds.length > 0
      ? allClaims.filter((c) => claimIds.includes(c.id))
      : matchClaimsToJob(job, allClaims)
          .slice(0, 15)
          .map((m) => m.claim);

  const bestPractices = await loadOrCreateBestPractices("resume_tailoring");
  const practicesText = formatBestPracticesForPrompt(bestPractices);
  const jobContext = buildJobContext(job);
  const sourcePacket = buildResumeSourcePacket({
    baseResumeText: baseResumeVersion.contentText,
    claims: selectedClaims,
    templateId: template.id,
  });

  const aiResult = await callAI({
    taskType: "resume_tailoring",
    systemPrompt: `${SYSTEM_PROMPT}${practicesText}`,
    userPrompt: buildUserPrompt({
      jobContext,
      baseResumeText: baseResumeVersion.contentText,
      claims: selectedClaims,
      templateGuidance: formatTemplatePrompt(template),
      sourcePacketGuidance: formatResumeSourcePacketForPrompt(sourcePacket),
    }),
    jobId: job.id,
    userId,
    modelOverride: options?.modelOverride,
    extraParams: RESUME_OUTPUT_PARAMS,
    validateContent: (content) => {
      if (content.trim().length < 200) {
        throw new Error(
          "empty_or_too_short_model_content: resume tailoring returned <200 chars",
        );
      }
    },
  });

  const tailoredText = aiResult.content.trim();
  const parsedDraft = parsePlainTextResumeDraft(tailoredText, sourcePacket);
  const rendered = renderResumePlainText({
    templateId: template.id,
    baseResumeText: baseResumeVersion.contentText,
    documentText: tailoredText,
    bullets: parsedDraft.items,
  });
  const factReview = reviewFacts({
    tailoredText,
    baseResumeText: baseResumeVersion.contentText,
    claims: selectedClaims,
  });

  try {
    assertMinimumContent(parsedDraft.items, aiResult.content, "resume bullets");
  } catch (error) {
    if (error instanceof TruthLockViolation) {
      return insertDiagnosticResumeVersion({
        userId,
        jobId: job.id,
        baseResumeVersionId: baseResumeVersion.id,
        templateId: template.id,
        claimIds: [],
        label: "AI tailored resume - truth lock failure",
        tailoredDocumentText: rendered.text,
        rawContent: aiResult.content,
        runId: aiResult.runId,
        eventLogId: aiResult.eventLogId,
        notes: `Truth lock failure: ${error.message}. Regenerate the resume to produce source-backed structured bullets.`,
        diffData: {
          modelContract: "resume_tailoring_v2_simple",
          modelName: aiResult.modelName,
          provider: aiResult.provider,
          finishReason: aiResult.finishReason,
          promptTokens: aiResult.promptTokens,
          completionTokens: aiResult.completionTokens,
          factReview,
          templateValidation: rendered.validation,
          sourceValidation: parsedDraft.validation,
          semanticValidation: {
            passed: false,
            violations: ["truth_lock_failure"],
            sectionCounts: parsedDraft.diagnostics.sectionCounts,
          },
          plainTextParseDiagnostics: parsedDraft.diagnostics,
          templateId: template.id,
          templateLabel: template.label,
          aiAttemptErrors: aiResult.priorFailures,
        },
      });
    }
    throw error;
  }

  const truthReview = reviewGeneratedTruth(
    parsedDraft.items.map((item) => ({
      text: item.text,
      claimIds: item.claimIds,
      section: item.section,
      role: item.claimIds.length === 0 ? "base-backed" : "body",
      jobKeywordsUsed: item.jobKeywordsUsed,
      gapNotes: item.gapNotes,
    })),
    {
      selectedClaims,
      baseResumeText: baseResumeVersion.contentText,
      jobSourceText: jobContext,
      allowUncitedRoles: ["base-backed"],
      sourcePolicy:
        "Resume facts must be traceable to the Claims Ledger, base resume, or job description. Unsupported lines require regeneration.",
    },
  );

  let qualityViolation: QualityViolation | null = null;
  try {
    validateResumeQuality(rendered.text, parsedDraft.items);
    await validateSemanticQuality(rendered.text, jobContext, job.id, userId);
  } catch (error) {
    if (error instanceof QualityViolation) {
      qualityViolation = error;
      logger.warn(
        { jobId: job.id, violations: error.violations },
        "Resume quality validation failed - storing diagnostic draft",
      );
    } else {
      throw error;
    }
  }

  const usedClaimIds = [...new Set(parsedDraft.items.flatMap((item) => item.claimIds))];
  const hasTemplateValidationFailure = rendered.validation.passed !== true;
  const hasTruthReviewFailure = truthReview.seriousViolationCount > 0;
  const hasBlockingDiagnostics =
    hasTemplateValidationFailure ||
    !parsedDraft.validation.passed ||
    qualityViolation != null ||
    hasTruthReviewFailure;

  const row = await insertDiagnosticResumeVersion({
    userId,
    jobId: job.id,
    baseResumeVersionId: baseResumeVersion.id,
    templateId: template.id,
    claimIds: usedClaimIds,
    label: "AI tailored resume",
    tailoredDocumentText: rendered.text,
    rawContent: aiResult.content,
    runId: aiResult.runId,
    eventLogId: aiResult.eventLogId,
    tailoredBullets: parsedDraft.items,
    notes: hasBlockingDiagnostics
      ? hasTemplateValidationFailure
        ? `Template validation failed. Omitted or disallowed sections: ${rendered.validation.omittedSections.join(", ") || "unknown"}. Regenerate the resume.`
        : !parsedDraft.validation.passed
        ? "Source validation failed. Regenerate the resume to restore structured source-backed bullets."
        : qualityViolation
          ? `Semantic template validation failed:\n${qualityViolation.violations.join("\n")}`
          : `Truth review failed with ${truthReview.seriousViolationCount} serious issue(s). Regenerate the resume.`
      : factReview.findings.length === 0
        ? "Tailored resume generated with structured source validation."
        : `Tailored resume generated with structured source validation. ${factReview.findings.length} advisory fact-review flag(s); see fact review panel.`,
    diffData: {
      modelContract: "resume_tailoring_v2_simple",
      modelName: aiResult.modelName,
      provider: aiResult.provider,
      finishReason: aiResult.finishReason,
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      factReview,
      truthReview,
      templateValidation: rendered.validation,
      sourceValidation: parsedDraft.validation,
      semanticValidation: {
        passed: qualityViolation == null,
        violations: qualityViolation?.violations ?? [],
        sectionCounts: parsedDraft.diagnostics.sectionCounts,
      },
      plainTextParseDiagnostics: parsedDraft.diagnostics,
      templateId: template.id,
      templateLabel: template.label,
      aiAttemptErrors: aiResult.priorFailures,
    },
  });

  logger.info(
    {
      jobId: job.id,
      resumeVersionId: row.id,
      modelName: aiResult.modelName,
      contentLength: rendered.text.length,
      factFindingCount: factReview.findings.length,
      claimCount: usedClaimIds.length,
      sourceValidItemCount: parsedDraft.validation.validItemCount,
      sourceInvalidItemCount: parsedDraft.validation.invalidItemCount,
      blockingDiagnostics: hasBlockingDiagnostics,
    },
    "Resume tailor pipeline completed",
  );

  return row;
}
