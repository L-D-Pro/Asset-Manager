import {
  db,
  resumeVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAI, parseJsonResponse } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { stripClaimIdRefs, reviewGeneratedTruth } from "./validation";
import { logger } from "../logger";
import { loadOrCreateBestPractices, formatBestPracticesForPrompt } from "../best-practices";
import {
  formatTemplatePrompt,
  getResumeTemplate,
  renderResumePlainText,
} from "../resume-templates";
import {
  buildResumeSourcePacket,
  formatResumeSourcePacketForPrompt,
  validateResumeTailoringPlan,
  type ResumeTailoringPlan,
  type ValidatedResumeItem,
  type ResumeSourceValidation,
} from "../resume-source-packet";
import type { Job, Claim } from "@workspace/db";

const RESUME_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sectionItems", "summary"],
  properties: {
    sectionItems: {
      type: "array",
      minItems: 1,
      maxItems: 28,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "text", "sourceRefs", "jobKeywordsUsed", "gapNotes"],
        properties: {
          section: {
            type: "string",
            enum: ["summary", "experience", "project", "education", "coursework", "involvement", "skills"],
          },
          text: { type: "string", minLength: 8, maxLength: 900 },
          sourceRefs: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: { type: "string" },
          },
          jobKeywordsUsed: {
            type: "array",
            maxItems: 12,
            items: { type: "string" },
          },
          gapNotes: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
        },
      },
    },
    summary: { type: "string" },
  },
} as const;

const RESUME_STRUCTURED_OUTPUT_PARAMS = {
  temperature: 0.1,
  max_tokens: 3600,
  timeoutMs: 45_000,
  provider: {
    require_parameters: true,
  },
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "resume_tailoring_plan",
      strict: true,
      schema: RESUME_PLAN_JSON_SCHEMA,
    },
  },
};

export class MissingBaseResumeError extends Error {
  constructor() {
    super("Base resume is required before tailoring. Save your current resume first.");
    this.name = "MissingBaseResumeError";
  }
}

const SYSTEM_PROMPT = `You are an expert ATS resume tailoring planner.

You do NOT write or format a full resume. You return a compact JSON tailoring plan only.
The application will validate your source references and render the final resume through a fixed ATS template.

Hard rules:
1. Use only facts from the provided CLAIM SOURCES and BASE RESUME SOURCES.
2. Every section item must cite at least one exact sourceRefs value from the packet.
3. Valid source refs look like claim:12 or base:experience:b003. Do not invent refs.
4. Claims are strongest evidence. Base resume refs are valid truth sources when a claim is not available.
5. Do not invent or inflate metrics, tools, titles, credentials, employers, dates, responsibilities, or company facts.
6. If the job asks for something not supported by sources, do not imply the candidate has it; put a short note in gapNotes.
7. Return clean prose only in text fields: no markdown, no bullets, no labels, no claim IDs in prose.
8. Keep the plan concise: summary/profile lines plus the strongest relevant experience, project, education, and skills items.
9. Mirror important job keywords only when the source material supports them.
10. Keep each item useful as one resume line or bullet after rendering.`;

function parsedPlanIsUsable(content: string, packet: ReturnType<typeof buildResumeSourcePacket>): boolean {
  const parsed = parseJsonResponse<ResumeTailoringPlan>(content);
  const { validation } = validateResumeTailoringPlan(parsed, packet);
  return validation.passed;
}

function getErrorRunId(error: unknown): string | null {
  return error && typeof error === "object" && "runId" in error && typeof (error as { runId?: unknown }).runId === "string"
    ? (error as { runId: string }).runId
    : null;
}

function getErrorEventLogId(error: unknown): number | null {
  return error && typeof error === "object" && "eventLogId" in error && typeof (error as { eventLogId?: unknown }).eventLogId === "number"
    ? (error as { eventLogId: number }).eventLogId
    : null;
}

async function saveDiagnosticResumeVersion(args: {
  job: Job;
  baseResumeVersionId: number;
  templateId: string;
  label: string;
  notes: string;
  rawContent?: string | null;
  runId?: string | null;
  eventLogId?: number | null;
  sourceValidation?: ResumeSourceValidation | null;
  sourceRefsAvailable?: number;
}): Promise<typeof resumeVersionsTable.$inferSelect> {
  const template = getResumeTemplate(args.templateId);
  const [row] = await db
    .insert(resumeVersionsTable)
    .values({
      jobId: args.job.id,
      label: args.label,
      status: "pending_approval",
      baseResumeVersionId: args.baseResumeVersionId,
      templateId: template.id,
      runId: args.runId ?? null,
      eventLogId: args.eventLogId ?? null,
      claimIds: [],
      tailoredBullets: [],
      tailoredDocumentText: null,
      rawContent: args.rawContent ?? null,
      diffData: {
        modelContract: "resume_tailoring_plan_v1",
        templateId: template.id,
        templateLabel: template.label,
        templateValidation: null,
        sourceValidation: args.sourceValidation ?? null,
        sourceRefsAvailable: args.sourceRefsAvailable ?? null,
      },
      notes: args.notes,
    })
    .returning();
  return row!;
}

function buildJobContext(job: Job): string {
  return `
Title: ${job.title}
Company: ${job.company}
Required Skills: ${(job.parsedRequiredSkills ?? []).join(", ") || "Not parsed yet"}
Nice-to-Have Skills: ${(job.parsedNiceToHaveSkills ?? []).join(", ") || ""}
Keywords: ${(job.parsedKeywords ?? []).join(", ") || ""}
Responsibilities: ${(job.parsedResponsibilities ?? []).join("; ") || "Not parsed yet"}
Raw Description:
${job.rawJdText ?? ""}
`.trim();
}

function toTruthReviewItems(items: ValidatedResumeItem[]) {
  return items.map((item) => ({
    text: item.text,
    claimIds: item.claimIds,
    role: item.claimIds.length > 0 ? "claim-backed" : "base-backed",
    section: item.section,
    jobKeywordsUsed: item.jobKeywordsUsed,
    gapNotes: item.gapNotes,
  }));
}

/**
 * Runs the MVP resume tailoring pipeline:
 * 1. Builds a compact source packet from the base resume and selected claims.
 * 2. Asks the model for sourced section items, not a full resume.
 * 3. Validates every source ref against claim/base-resume sources.
 * 4. Renders the final resume deterministically through the selected template.
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
    templateId?: string | null;
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

  const template = getResumeTemplate(options?.templateId);
  const templateContext = formatTemplatePrompt(template);

  const selectedClaims = claimIds && claimIds.length > 0
    ? allClaims.filter((claim) => claimIds.includes(claim.id))
    : matchClaimsToJob(job, allClaims).slice(0, 15).map((match) => match.claim);

  const packet = buildResumeSourcePacket({
    baseResumeText: baseResumeVersion.contentText,
    claims: selectedClaims,
    templateId: template.id,
  });

  if (packet.baseSources.length === 0) {
    return saveDiagnosticResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      templateId: template.id,
      label: "AI tailored - base resume parse failed",
      notes: "The current base resume could not be parsed into source snippets, so the resume was not generated. Review the base resume text and regenerate.",
      sourceRefsAvailable: 0,
    });
  }

  const jobContext = buildJobContext(job);
  const researchContext =
    job.researchData != null ? JSON.stringify(job.researchData).slice(0, 3000) : "No stored research available.";
  const bestPractices = await loadOrCreateBestPractices("resume_tailoring");
  const practicesText = formatBestPracticesForPrompt(bestPractices);
  const sourcePacketPrompt = formatResumeSourcePacketForPrompt(packet);

  let aiResult: Awaited<ReturnType<typeof callAI>>;
  try {
    aiResult = await callAI({
      taskType: "resume_tailoring",
      systemPrompt: `${SYSTEM_PROMPT}${practicesText}\n\nTEMPLATE CONTRACT:\n${templateContext}`,
      userPrompt:
        `Create a compact resume tailoring plan for this job. Return only JSON matching the schema.\n\n` +
        `JOB CONTEXT\n${jobContext}\n\n` +
        `STORED JOB/COMPANY RESEARCH\n${researchContext}\n\n` +
        `SOURCE PACKET\n${sourcePacketPrompt}`,
      jobId: job.id,
      modelOverride: options?.modelOverride,
      extraParams: RESUME_STRUCTURED_OUTPUT_PARAMS,
      validateContent: (content) => {
        if (!parsedPlanIsUsable(content, packet)) {
          throw new Error("Resume tailoring plan did not pass compact JSON/source-ref validation.");
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ jobId: job.id, error: message }, "Resume tailoring AI call failed");
    return saveDiagnosticResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      templateId: template.id,
      label: "AI tailored - generation failed",
      notes: `Resume generation failed after the configured model/fallback attempts: ${message}`,
      rawContent: message,
      runId: getErrorRunId(error),
      eventLogId: getErrorEventLogId(error),
      sourceRefsAvailable: packet.baseSources.length + packet.claims.length,
    });
  }

  const parsed = parseJsonResponse<ResumeTailoringPlan>(aiResult.content);
  const { items, validation: sourceValidation } = validateResumeTailoringPlan(parsed, packet);

  if (!sourceValidation.passed) {
    logger.warn({ jobId: job.id, sourceValidation }, "Resume source validation failed");
    return saveDiagnosticResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      templateId: template.id,
      label: "AI tailored - source validation failed",
      notes: "Resume generation needs review: the model returned a compact plan, but one or more items lacked valid claim/base-resume source references. Regenerate or adjust claims/base resume.",
      rawContent: aiResult.content,
      runId: aiResult.runId,
      eventLogId: aiResult.eventLogId,
      sourceValidation,
      sourceRefsAvailable: packet.baseSources.length + packet.claims.length,
    });
  }

  const cleanedItems = items.map((item) => ({
    ...item,
    text: stripClaimIdRefs(item.text),
  }));
  const rendered = renderResumePlainText({
    templateId: template.id,
    baseResumeText: baseResumeVersion.contentText,
    documentText: null,
    bullets: cleanedItems,
  });

  const truthReview = reviewGeneratedTruth(toTruthReviewItems(cleanedItems), {
    selectedClaims,
    baseResumeText: baseResumeVersion.contentText,
    jobSourceText: jobContext,
    researchSourceText: researchContext,
    allowUncitedRoles: ["base-backed"],
    sourcePolicy:
      "Resume facts must cite either a selected Claims Ledger entry or a parsed base resume source snippet. Base-resume-backed content is allowed for MVP tailoring.",
  });

  if (truthReview.seriousViolationCount > 0) {
    logger.warn({ jobId: job.id, truthReview }, "Resume truth review failed");
    return saveDiagnosticResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      templateId: template.id,
      label: "AI tailored - truth review failed",
      notes: "Resume generation needs review: the generated plan passed source references but failed deterministic truth review for metrics, credentials, disallowed implications, or unsupported facts.",
      rawContent: aiResult.content,
      runId: aiResult.runId,
      eventLogId: aiResult.eventLogId,
      sourceValidation,
      sourceRefsAvailable: packet.baseSources.length + packet.claims.length,
    });
  }

  const [row] = await db
    .insert(resumeVersionsTable)
    .values({
      jobId: job.id,
      label: "AI tailored resume",
      status: "pending_approval",
      baseResumeVersionId: baseResumeVersion.id,
      templateId: template.id,
      runId: aiResult.runId,
      eventLogId: aiResult.eventLogId,
      claimIds: selectedClaims.map((claim) => claim.id),
      tailoredBullets: cleanedItems,
      tailoredDocumentText: rendered.text,
      rawContent: aiResult.content,
      diffData: {
        modelContract: "resume_tailoring_plan_v1",
        templateId: template.id,
        templateLabel: template.label,
        templateValidation: rendered.validation,
        sourceValidation,
        truthReview,
        sourceRefsUsed: cleanedItems.flatMap((item) => item.sourceRefs),
        sourceRefsAvailable: packet.baseSources.length + packet.claims.length,
        claimBackedItemCount: sourceValidation.claimBackedCount,
        baseBackedItemCount: sourceValidation.baseBackedCount,
      },
      notes:
        sourceValidation.claimBackedCount === 0
          ? "Generated from base resume sources only. Claim-backed tailoring is limited because no selected claims matched this job."
          : "Generated from compact sourced resume plan and rendered through the selected ATS template.",
    })
    .returning();

  logger.info(
    {
      jobId: job.id,
      resumeVersionId: row!.id,
      sourceValidation,
      modelName: aiResult.modelName,
    },
    "Resume tailor pipeline completed",
  );

  return row!;
}
