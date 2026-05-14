import {
  db,
  resumeVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAI } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { logger } from "../logger";
import {
  loadOrCreateBestPractices,
  formatBestPracticesForPrompt,
} from "../best-practices";
import { getResumeTemplate } from "../resume-templates";
import { reviewFacts } from "./fact-review";
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
- Reorder, rephrase, emphasize, and prune freely — that is the tailoring.
- Match the job's required-skill vocabulary where it accurately reflects the candidate's experience.
- Keep the original company names and date ranges from the base resume.
- Plain text only. No markdown, no JSON, no preamble, no commentary — just the resume.`;

function buildUserPrompt(args: {
  job: Job;
  baseResumeText: string;
  claims: Claim[];
  templateGuidance: string;
}): string {
  const claimsBlock =
    args.claims.length === 0
      ? "(no claims selected — rely on the base resume)"
      : args.claims
          .map(
            (c, i) =>
              `${i + 1}. ${c.summary}${c.evidence ? ` — evidence: ${c.evidence}` : ""}`,
          )
          .join("\n");

  const jobBlock = [
    `Title: ${args.job.title}`,
    `Company: ${args.job.company}`,
    args.job.parsedRequiredSkills?.length
      ? `Required skills: ${args.job.parsedRequiredSkills.join(", ")}`
      : "",
    args.job.parsedNiceToHaveSkills?.length
      ? `Nice to have: ${args.job.parsedNiceToHaveSkills.join(", ")}`
      : "",
    args.job.rawJdText ? `\nFull JD:\n${args.job.rawJdText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `TARGET JOB`,
    jobBlock,
    ``,
    `BASE RESUME`,
    args.baseResumeText,
    ``,
    `APPROVED CLAIMS`,
    claimsBlock,
    ``,
    `FORMAT GUIDANCE`,
    args.templateGuidance,
    ``,
    `Now write the tailored resume.`,
  ].join("\n");
}

/**
 * Runs the simplified resume tailoring pipeline:
 * 1. Loads the current base resume.
 * 2. Resolves selected claims (either explicit IDs or top-15 by relevance match).
 * 3. One AI call: base resume + JD + claims → tailored plain-text resume.
 * 4. Saves the AI's raw output verbatim as `tailoredDocumentText`.
 * 5. Post-hoc fact review surfaces companies/dates/metrics not present in sources.
 *
 * The output is never replaced or filtered — fact-review findings are advisory
 * and shown to the user for manual review.
 */
export async function runResumeTailorPipeline(
  job: Job,
  allClaims: Claim[],
  claimIds?: number[],
  options?: {
    modelOverride?: { provider?: string; modelName: string };
    templateId?: string | null;
  },
): Promise<typeof resumeVersionsTable.$inferSelect> {
  logger.info(
    { jobId: job.id, claimIds },
    "Starting resume tailor pipeline (v2 simplified)",
  );

  const [baseResumeVersion] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.isCurrent, true));
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

  const aiResult = await callAI({
    taskType: "resume_tailoring",
    systemPrompt: `${SYSTEM_PROMPT}${practicesText}`,
    userPrompt: buildUserPrompt({
      job,
      baseResumeText: baseResumeVersion.contentText,
      claims: selectedClaims,
      templateGuidance: template.label,
    }),
    jobId: job.id,
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
  const factReview = reviewFacts({
    tailoredText,
    baseResumeText: baseResumeVersion.contentText,
    claims: selectedClaims,
  });

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
      claimIds: selectedClaims.map((c) => c.id),
      tailoredBullets: [],
      tailoredDocumentText: tailoredText,
      rawContent: aiResult.content,
      diffData: {
        modelContract: "resume_tailoring_v2_simple",
        modelName: aiResult.modelName,
        provider: aiResult.provider,
        finishReason: aiResult.finishReason,
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
        factReview,
        templateId: template.id,
        templateLabel: template.label,
        aiAttemptErrors: aiResult.priorFailures,
      },
      notes:
        factReview.findings.length === 0
          ? "Tailored resume generated. No unverified facts detected."
          : `Tailored resume generated. ${factReview.findings.length} item(s) need review — see fact review panel.`,
    })
    .returning();

  logger.info(
    {
      jobId: job.id,
      resumeVersionId: row!.id,
      modelName: aiResult.modelName,
      contentLength: tailoredText.length,
      factFindingCount: factReview.findings.length,
      claimCount: selectedClaims.length,
    },
    "Resume tailor pipeline completed (v2)",
  );

  return row!;
}
