import {
  db,
  resumeVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAI, type AiAttemptFailure } from "../ai-client";
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
  parsePlainTextResumeDraft,
  type BaseResumeSource,
  type ResumeSourcePacket,
  type ValidatedResumeItem,
  type ResumeSourceValidation,
} from "../resume-source-packet";
import type { Job, Claim } from "@workspace/db";
import type { ResumeSectionKey } from "../resume-templates";

const RESUME_PLAIN_TEXT_OUTPUT_PARAMS = {
  temperature: 0.25,
  max_tokens: 3200,
  timeoutMs: 25_000,
  maxAttempts: 2,
};

export class MissingBaseResumeError extends Error {
  constructor() {
    super("Base resume is required before tailoring. Save your current resume first.");
    this.name = "MissingBaseResumeError";
  }
}

const SYSTEM_PROMPT = `You are an expert ATS resume writer.

You write a plain-text ATS resume draft in a deterministic section format.
The application will validate your source tags and render the final resume through a fixed ATS template.

Hard rules:
1. Use only facts from the provided CLAIM SOURCES and BASE RESUME SOURCES.
2. Every resume content line must end with one or more source tags like [src:claim:12] or [src:base:experience:b003].
3. Use only exact source refs from the packet. Do not invent refs.
4. Claims are strongest evidence. Base resume refs are valid truth sources when a claim is not available.
5. Do not invent or inflate metrics, tools, titles, credentials, employers, dates, responsibilities, or company facts.
6. If the job asks for something not supported by sources, omit it.
7. Return clean plain text only: no markdown, no JSON, no commentary, no labels except section headings.
8. Keep the draft concise: summary/profile lines plus the strongest relevant experience, project, education, and skills items.
9. Mirror important job keywords only when the source material supports them.
10. Experience must include multiple dated entries in this exact shape: Title | Company | Location | Date Range [src:...].
11. Reject directive language. Never output instruction text like "Highlight..." or "Include...".
12. Preserve candidate chronology and ATS readability.

Required output shape:
HEADER
Candidate name and contact lines

SUMMARY
Resume summary sentence [src:...]

EXPERIENCE
Title | Company | Location | Date Range [src:...]
Achievement bullet text [src:...]
Achievement bullet text [src:...]

PROJECT
Project line if relevant [src:...]

EDUCATION
Education or certification line [src:...]

SKILLS
Skill category: comma-separated supported skills [src:...]`;

const MIN_ITEMS_BY_SECTION: Record<ResumeSectionKey, number> = {
  summary: 1,
  experience: 4,
  project: 2,
  education: 2,
  coursework: 1,
  involvement: 1,
  skills: 3,
};

function sanitizeAscii(value: string): string {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function normalizeResumeLine(value: string): string {
  return sanitizeAscii(value)
    .replace(/\s+/g, " ")
    .trim();
}

function splitItemText(section: ResumeSectionKey, text: string): string[] {
  const normalized = normalizeResumeLine(text);
  if (!normalized) return [];
  if (section === "summary") return [normalized];

  const chunks = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .flatMap((segment) => segment.split(/\s+\|\s+/g))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 18);

  if (chunks.length <= 1) return [normalized];
  return chunks.slice(0, 4);
}

function looksLikeDirectiveText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return /^(highlight|emphasize|include|list|showcase|stress|demonstrate|detail|note|mention|add|outline)\b/.test(normalized);
}

function hasDateSignal(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text);
}

function scoreExperienceSource(text: string): number {
  let score = 0;
  if (hasDateSignal(text)) score += 5;
  if (/\|/.test(text)) score += 2;
  if (/(designer|developer|manager|lead|specialist|director|engineer|analyst)/i.test(text)) score += 2;
  if (/(remote|onsite|hybrid)/i.test(text)) score += 1;
  return score;
}

function ensureSectionCoverage(args: {
  items: ValidatedResumeItem[];
  packet: ResumeSourcePacket;
}): ValidatedResumeItem[] {
  const usedRefs = new Set(args.items.flatMap((item) => item.sourceRefs));
  const bySection = new Map<ResumeSectionKey, ValidatedResumeItem[]>();
  const pushItem = (item: ValidatedResumeItem) => {
    const current = bySection.get(item.section) ?? [];
    current.push(item);
    bySection.set(item.section, current);
  };

  const filteredInputItems = args.items.filter((item) => !looksLikeDirectiveText(item.text));
  for (const item of filteredInputItems) {
    pushItem(item);
  }

  const addFromBaseSource = (source: BaseResumeSource): boolean => {
    if (usedRefs.has(source.ref)) return false;
    const text = normalizeResumeLine(source.text);
    if (!text || text.length < 18) return false;
    const section = source.section;
    const item: ValidatedResumeItem = {
      text,
      section,
      claimIds: [],
      sourceRefs: [source.ref],
      baseSourceRefs: [source.ref],
      jobKeywordsUsed: [],
      gapNotes: [],
      sourceMap: {
        sourceRefs: [source.ref],
        sourceClaimIds: [],
        baseSourceRefs: [source.ref],
      },
    };
    usedRefs.add(source.ref);
    pushItem(item);
    return true;
  };

  const addFromClaim = (claimId: number, summary: string, section: ResumeSectionKey): boolean => {
    const ref = `claim:${claimId}`;
    if (usedRefs.has(ref)) return false;
    const text = normalizeResumeLine(summary);
    if (!text || text.length < 18) return false;
    const item: ValidatedResumeItem = {
      text,
      section,
      claimIds: [claimId],
      sourceRefs: [ref],
      baseSourceRefs: [],
      jobKeywordsUsed: [],
      gapNotes: [],
      sourceMap: {
        sourceRefs: [ref],
        sourceClaimIds: [claimId],
        baseSourceRefs: [],
      },
    };
    usedRefs.add(ref);
    pushItem(item);
    return true;
  };

  const claimBackedCount = args.items.filter((item) => item.claimIds.length > 0).length;
  const minClaimBacked = Math.min(2, args.packet.claims.length);
  if (claimBackedCount < minClaimBacked) {
    for (const claim of args.packet.claims) {
      const added = addFromClaim(claim.id, claim.summary, "experience");
      if (added && (bySection.get("experience") ?? []).length >= MIN_ITEMS_BY_SECTION.experience) break;
      const nowClaimBacked = Array.from(bySection.values()).flat().filter((item) => item.claimIds.length > 0).length;
      if (nowClaimBacked >= minClaimBacked) break;
    }
  }

  for (const section of args.packet.allowedSections) {
    const targetCount = MIN_ITEMS_BY_SECTION[section] ?? 1;
    const currentCount = (bySection.get(section) ?? []).length;
    if (currentCount >= targetCount) continue;

    const sectionSources = args.packet.baseSources
      .filter((source) => source.section === section)
      .sort((a, b) => scoreExperienceSource(b.text) - scoreExperienceSource(a.text));
    for (const source of sectionSources) {
      addFromBaseSource(source);
      if ((bySection.get(section) ?? []).length >= targetCount) break;
    }
  }

  const experienceItems = bySection.get("experience") ?? [];
  const hasChronologicalExperience = experienceItems.some((item) => hasDateSignal(item.text));
  if (!hasChronologicalExperience) {
    const experienceSources = args.packet.baseSources
      .filter((source) => source.section === "experience")
      .sort((a, b) => scoreExperienceSource(b.text) - scoreExperienceSource(a.text));
    for (const source of experienceSources) {
      if (!hasDateSignal(source.text)) continue;
      addFromBaseSource(source);
      const nowHasDates = (bySection.get("experience") ?? []).some((item) => hasDateSignal(item.text));
      if (nowHasDates) break;
    }
  }

  return args.packet.allowedSections.flatMap((section) => bySection.get(section) ?? []);
}

function expandAndNormalizeItems(items: ValidatedResumeItem[]): ValidatedResumeItem[] {
  const expanded: ValidatedResumeItem[] = [];
  for (const item of items) {
    const parts = splitItemText(item.section, item.text);
    for (const part of parts) {
      expanded.push({
        ...item,
        text: part,
      });
    }
  }
  return expanded;
}

interface SemanticTemplateValidation {
  passed: boolean;
  issues: string[];
  sectionCounts: Partial<Record<ResumeSectionKey, number>>;
  hasDatedExperience: boolean;
  hasExperienceHeaderLikeLine: boolean;
}

function validateSemanticTemplateContract(args: {
  items: ValidatedResumeItem[];
  templateSections: ResumeSectionKey[];
}): SemanticTemplateValidation {
  const issues: string[] = [];
  const sectionCounts: Partial<Record<ResumeSectionKey, number>> = {};
  for (const section of args.templateSections) {
    sectionCounts[section] = args.items.filter((item) => item.section === section).length;
  }

  for (const item of args.items) {
    if (looksLikeDirectiveText(item.text)) {
      issues.push(`Directive language found in ${item.section}: "${item.text.slice(0, 70)}"`);
    }
  }

  const summaryCount = sectionCounts.summary ?? 0;
  if (summaryCount < 1) {
    issues.push("Summary section is missing.");
  }

  const experienceItems = args.items.filter((item) => item.section === "experience");
  const hasDatedExperience = experienceItems.some((item) => hasDateSignal(item.text));
  const hasExperienceHeaderLikeLine = experienceItems.some((item) =>
    hasDateSignal(item.text) && (/\|/.test(item.text) || / - /.test(item.text) || / at /i.test(item.text)),
  );

  if (experienceItems.length < 4) {
    issues.push("Experience section is too short; expected multiple scoped entries.");
  }
  if (!hasDatedExperience) {
    issues.push("Experience section is missing date signals (month/year or year).");
  }
  if (!hasExperienceHeaderLikeLine) {
    issues.push("Experience section is missing role/company/date-style header lines.");
  }

  const educationCount = sectionCounts.education ?? 0;
  if (educationCount < 1) {
    issues.push("Education section is missing.");
  }

  const skillsCount = sectionCounts.skills ?? 0;
  if (skillsCount < 2) {
    issues.push("Skills section is too short.");
  }

  return {
    passed: issues.length === 0,
    issues,
    sectionCounts,
    hasDatedExperience,
    hasExperienceHeaderLikeLine,
  };
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

function getErrorAttemptErrors(error: unknown): AiAttemptFailure[] {
  if (!error || typeof error !== "object" || !("attemptErrors" in error)) return [];
  const attempts = (error as { attemptErrors?: unknown }).attemptErrors;
  return Array.isArray(attempts) ? attempts.filter((attempt): attempt is AiAttemptFailure => typeof attempt === "object" && attempt != null) : [];
}

function formatAttemptSummary(attempts: AiAttemptFailure[]): string {
  if (attempts.length === 0) return "No model-attempt details were recorded.";
  return attempts
    .map((attempt) => `${attempt.modelName}: ${attempt.category} (${attempt.error})`)
    .join(" | ");
}

function buildBaseResumeFallbackItems(packet: ResumeSourcePacket): ValidatedResumeItem[] {
  const items: ValidatedResumeItem[] = [];
  const allowed = new Set(packet.allowedSections);
  for (const source of packet.baseSources) {
    if (!allowed.has(source.section)) continue;
    const text = normalizeResumeLine(source.text);
    if (!text || text.length < 16) continue;
    items.push({
      text,
      section: source.section,
      claimIds: [],
      sourceRefs: [source.ref],
      baseSourceRefs: [source.ref],
      jobKeywordsUsed: [],
      gapNotes: [],
      sourceMap: {
        sourceRefs: [source.ref],
        sourceClaimIds: [],
        baseSourceRefs: [source.ref],
      },
    });
  }
  return items;
}

function sourceValidationForItems(items: ValidatedResumeItem[]): ResumeSourceValidation {
  return {
    passed: items.length > 0,
    validItemCount: items.length,
    invalidItemCount: 0,
    claimBackedCount: items.filter((item) => item.claimIds.length > 0).length,
    baseBackedCount: items.filter((item) => item.baseSourceRefs.length > 0).length,
    invalidItems: [],
  };
}

function contentFailureAttempt(args: {
  aiResult: Awaited<ReturnType<typeof callAI>>;
  error: string;
  category?: string;
}): AiAttemptFailure {
  const priorFailures = Array.isArray(args.aiResult.priorFailures) ? args.aiResult.priorFailures : [];
  return {
    attemptNumber: priorFailures.length + 1,
    modelId: 0,
    modelName: args.aiResult.modelName,
    provider: args.aiResult.provider,
    error: args.error,
    category: args.category ?? "content_contract",
    elapsedMs: 0,
  };
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
        modelContract: "resume_tailoring_plain_text_v1",
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

async function saveDeterministicFallbackResumeVersion(args: {
  job: Job;
  baseResumeVersionId: number;
  baseResumeText: string;
  templateId: string;
  items: ValidatedResumeItem[];
  selectedClaims: Claim[];
  jobContext: string;
  researchContext: string;
  runId: string | null;
  eventLogId: number | null;
  attemptErrors: AiAttemptFailure[];
}): Promise<typeof resumeVersionsTable.$inferSelect> {
  const template = getResumeTemplate(args.templateId);
  const sourceValidation = sourceValidationForItems(args.items);
  const semanticValidation = validateSemanticTemplateContract({
    items: args.items,
    templateSections: template.sectionOrder,
  });
  const rendered = renderResumePlainText({
    templateId: template.id,
    baseResumeText: args.baseResumeText,
    documentText: null,
    bullets: args.items,
  });
  const truthReview = reviewGeneratedTruth(toTruthReviewItems(args.items), {
    selectedClaims: args.selectedClaims,
    baseResumeText: args.baseResumeText,
    jobSourceText: args.jobContext,
    researchSourceText: args.researchContext,
    allowUncitedRoles: ["base-backed"],
    sourcePolicy:
      "Deterministic fallback resume facts must cite parsed base resume source snippets. Base-resume-backed content is allowed for MVP tailoring.",
  });

  if (!sourceValidation.passed || !semanticValidation.passed || truthReview.seriousViolationCount > 0) {
    return saveDiagnosticResumeVersion({
      job: args.job,
      baseResumeVersionId: args.baseResumeVersionId,
      templateId: template.id,
      label: "AI tailored - fallback validation failed",
      notes:
        "Resume generation needs review: AI attempts failed and deterministic base-resume fallback did not pass source/template/truth validation.",
      rawContent: formatAttemptSummary(args.attemptErrors),
      runId: args.runId,
      eventLogId: args.eventLogId,
      sourceValidation,
      sourceRefsAvailable: args.items.length,
    });
  }

  const [row] = await db
    .insert(resumeVersionsTable)
    .values({
      jobId: args.job.id,
      label: "ATS resume from verified base sources",
      status: "pending_approval",
      baseResumeVersionId: args.baseResumeVersionId,
      templateId: template.id,
      runId: args.runId,
      eventLogId: args.eventLogId,
      claimIds: args.selectedClaims.map((claim) => claim.id),
      tailoredBullets: args.items,
      tailoredDocumentText: rendered.text,
      rawContent: null,
      diffData: {
        modelContract: "deterministic_base_resume_fallback_v1",
        templateId: template.id,
        templateLabel: template.label,
        templateValidation: rendered.validation,
        sourceValidation,
        semanticValidation,
        truthReview,
        aiAttemptErrors: args.attemptErrors,
        aiAttemptSummary: formatAttemptSummary(args.attemptErrors),
        failureCategory: args.attemptErrors.at(-1)?.category ?? "content_contract",
        compatMode: "deterministic_fallback",
        sourceRefsUsed: args.items.flatMap((item) => item.sourceRefs),
        sourceRefsAvailable: args.items.length,
        claimBackedItemCount: 0,
        baseBackedItemCount: args.items.length,
      },
      notes:
        "AI structured tailoring was unavailable after the configured model attempts. Generated a deterministic ATS resume from verified base resume sources so the draft can still be reviewed.",
    })
    .returning();

  return row!;
}

/**
 * Runs the MVP resume tailoring pipeline:
 * 1. Builds a source packet from the base resume and selected claims.
 * 2. Asks the model for a source-tagged plain-text resume draft.
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
        `Create a plain-text ATS resume draft for this job. Return only the resume draft, using source tags on every content line.\n\n` +
        `JOB CONTEXT\n${jobContext}\n\n` +
        `STORED JOB/COMPANY RESEARCH\n${researchContext}\n\n` +
        `SOURCE PACKET\n${sourcePacketPrompt}`,
      jobId: job.id,
      modelOverride: options?.modelOverride,
      extraParams: RESUME_PLAIN_TEXT_OUTPUT_PARAMS,
      validateContent: (content) => {
        if (content.trim().length === 0) {
          throw new Error("empty_model_content: resume tailoring model returned empty content.");
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attemptErrors = getErrorAttemptErrors(error);
    logger.error(
      { jobId: job.id, error: message, attemptErrors },
      "Resume tailoring AI call failed; using deterministic base-resume fallback",
    );
    const fallbackItems = buildBaseResumeFallbackItems(packet);
    return saveDeterministicFallbackResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      baseResumeText: baseResumeVersion.contentText,
      templateId: template.id,
      items: fallbackItems,
      selectedClaims,
      jobContext,
      researchContext,
      runId: getErrorRunId(error),
      eventLogId: getErrorEventLogId(error),
      attemptErrors,
    });
  }

  const {
    items,
    validation: sourceValidation,
    diagnostics: plainTextParseDiagnostics,
  } = parsePlainTextResumeDraft(aiResult.content, packet);

  logger.info(
    {
      jobId: job.id,
      runId: aiResult.runId,
      modelName: aiResult.modelName,
      requestMode: "plain_text_v1",
      finishReason: aiResult.finishReason,
      contentLength: aiResult.content.length,
      parsedSectionCounts: plainTextParseDiagnostics.sectionCounts,
      validSourceTagCount: plainTextParseDiagnostics.validSourceTagCount,
      invalidSourceTagCount: plainTextParseDiagnostics.invalidSourceTagCount,
      parsedLineCount: plainTextParseDiagnostics.parsedLineCount,
    },
    "Resume plain-text draft parsed",
  );

  if (items.length === 0) {
    logger.warn({ jobId: job.id, sourceValidation }, "Resume source validation failed");
    return saveDeterministicFallbackResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      baseResumeText: baseResumeVersion.contentText,
      templateId: template.id,
      items: buildBaseResumeFallbackItems(packet),
      selectedClaims,
      jobContext,
      researchContext,
      runId: aiResult.runId,
      eventLogId: aiResult.eventLogId,
      attemptErrors: [
        ...(Array.isArray(aiResult.priorFailures) ? aiResult.priorFailures : []),
        contentFailureAttempt({
          aiResult,
          error: "Plain-text resume draft could not be parsed into source-backed lines.",
          category: "parse_failed",
        }),
      ],
    });
  }

  const toppedUpItems = ensureSectionCoverage({
    items,
    packet,
  });

  const expandedItems = expandAndNormalizeItems(toppedUpItems);
  const cleanedItems = expandedItems.map((item) => ({
    ...item,
    text: normalizeResumeLine(stripClaimIdRefs(item.text)),
  })).filter((item) => item.text.length >= 16 && !looksLikeDirectiveText(item.text));
  const finalSourceValidation = sourceValidationForItems(cleanedItems);
  const finalClaimBackedItemCount = cleanedItems.filter((item) => item.claimIds.length > 0).length;
  const finalBaseBackedItemCount = cleanedItems.filter((item) => item.baseSourceRefs.length > 0).length;
  const semanticValidation = validateSemanticTemplateContract({
    items: cleanedItems,
    templateSections: template.sectionOrder,
  });

  if (!semanticValidation.passed) {
    logger.warn({ jobId: job.id, semanticValidation }, "Resume semantic template validation failed");
    return saveDeterministicFallbackResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      baseResumeText: baseResumeVersion.contentText,
      templateId: template.id,
      items: buildBaseResumeFallbackItems(packet),
      selectedClaims,
      jobContext,
      researchContext,
      runId: aiResult.runId,
      eventLogId: aiResult.eventLogId,
      attemptErrors: [
        ...(Array.isArray(aiResult.priorFailures) ? aiResult.priorFailures : []),
        contentFailureAttempt({
          aiResult,
          error: `Plain-text resume draft missed template invariants: ${semanticValidation.issues.join(" | ")}`,
          category: "template_invariant_failed",
        }),
      ],
    });
  }

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
    return saveDeterministicFallbackResumeVersion({
      job,
      baseResumeVersionId: baseResumeVersion.id,
      baseResumeText: baseResumeVersion.contentText,
      templateId: template.id,
      items: buildBaseResumeFallbackItems(packet),
      selectedClaims,
      jobContext,
      researchContext,
      runId: aiResult.runId,
      eventLogId: aiResult.eventLogId,
      attemptErrors: [
        ...(Array.isArray(aiResult.priorFailures) ? aiResult.priorFailures : []),
        contentFailureAttempt({
          aiResult,
          error: "Plain-text resume draft failed deterministic truth review.",
          category: "truth_review",
        }),
      ],
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
        modelContract: "resume_tailoring_plain_text_v1",
        requestMode: "plain_text_v1",
        templateId: template.id,
        templateLabel: template.label,
        templateValidation: rendered.validation,
        sourceValidation: finalSourceValidation,
        aiSourceValidation: sourceValidation,
        plainTextParseDiagnostics,
        truthReview,
        sourceRefsUsed: cleanedItems.flatMap((item) => item.sourceRefs),
        sourceRefsAvailable: packet.baseSources.length + packet.claims.length,
        claimBackedItemCount: finalClaimBackedItemCount,
        baseBackedItemCount: finalBaseBackedItemCount,
        semanticValidation,
        postProcessing: {
          expandedItemCount: expandedItems.length,
          toppedUpItemCount: toppedUpItems.length,
          cleanedItemCount: cleanedItems.length,
        },
        aiAttemptErrors: aiResult.priorFailures ?? [],
        aiAttemptSummary: formatAttemptSummary(aiResult.priorFailures ?? []),
        failureCategory: null,
        compatMode: "plain_text_v1",
        compatibilityNote: aiResult.compatibilityNote ?? null,
      },
      notes:
        finalClaimBackedItemCount === 0
          ? "Generated from a source-tagged plain-text resume draft and base resume sources. Claim-backed tailoring is limited because no selected claims matched this job."
          : "Generated from a source-tagged plain-text resume draft and rendered through the selected ATS template.",
    })
    .returning();

  logger.info(
    {
      jobId: job.id,
      resumeVersionId: row!.id,
      requestMode: "plain_text_v1",
      sourceValidation: finalSourceValidation,
      plainTextParseDiagnostics,
      renderedItemCount: cleanedItems.length,
      modelName: aiResult.modelName,
    },
    "Resume tailor pipeline completed",
  );

  return row!;
}
