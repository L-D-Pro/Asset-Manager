import { db, resumeVersionsTable } from "@workspace/db";
import { callAI, parseJsonResponse } from "../ai-client";
import { matchClaimsToJob } from "../scoring";
import { logger } from "../logger";
import type { Job, Claim } from "@workspace/db";

interface TailoredBullet {
  text: string;
  claimIds: number[];
  section: string;
  isAggregated: boolean;
  originalText: string | null;
}

interface TailoringResult {
  bullets: TailoredBullet[];
  addedBullets: string[];
  removedBullets: string[];
  reorderedSections: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are an expert resume writer and career coach specializing in ATS-optimized resumes.
Your task is to tailor resume bullet points to a specific job, using ONLY the provided claims as source material.
CRITICAL RULES — NEVER VIOLATE:
1. Every bullet MUST trace back to a provided claim. Do NOT invent new achievements.
2. Do NOT aggregate or combine claims in ways that imply more than what's stated.
3. Bullets that combine multiple claims must explicitly flag isAggregated: true.
4. Use strong action verbs and quantifiable language where supported by claims.
5. Match the job's required skills and keywords where truthfully supported by claims.

Return ONLY valid JSON with this exact structure:
{
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
 * 3. Stores the result as a new ResumeVersion in pending_approval state
 * Returns the new ResumeVersion.
 */
export async function runResumeTailorPipeline(
  job: Job,
  allClaims: Claim[],
  claimIds?: number[],
): Promise<typeof resumeVersionsTable.$inferSelect> {
  logger.info({ jobId: job.id, claimIds }, "Starting resume tailor pipeline");

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
    userPrompt: `Tailor resume bullets for this job:\n\n${jobContext}\n\nAvailable claims (use ONLY these):\n${claimsContext}`,
    jobId: job.id,
  });

  const parsed = parseJsonResponse<TailoringResult>(result.content);

  const tailoredBullets = parsed?.bullets ?? [];
  const usedClaimIds = [
    ...new Set(tailoredBullets.flatMap((b) => b.claimIds)),
  ];
  const diffData = {
    addedBullets: parsed?.addedBullets ?? [],
    removedBullets: parsed?.removedBullets ?? [],
    reorderedSections: parsed?.reorderedSections ?? [],
    summary: parsed?.summary ?? "",
    generatedAt: new Date().toISOString(),
    modelName: result.modelName,
  };

  const [row] = await db
    .insert(resumeVersionsTable)
    .values({
      jobId: job.id,
      label: `AI tailored — ${new Date().toLocaleDateString()}`,
      status: "pending_approval",
      claimIds: usedClaimIds,
      tailoredBullets: tailoredBullets as unknown as Record<string, unknown>[],
      diffData: diffData as unknown as Record<string, unknown>,
      notes: parsed?.summary ?? "AI-generated resume tailoring",
    })
    .returning();

  logger.info(
    { jobId: job.id, resumeVersionId: row!.id, bulletsGenerated: tailoredBullets.length },
    "Resume tailor pipeline completed",
  );

  return row!;
}
