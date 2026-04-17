import { CreateClaimBody } from "@workspace/api-zod";
import { callAI, parseJsonResponse } from "../ai-client";
import { MAX_AI_SOURCE_CHARS, truncateForAi } from "../document-text";
import { logger } from "../logger";

export interface DraftClaimsInput {
  sourceText: string;
  prompt: string;
  extractedText: string;
  filename: string | null;
}

export interface DraftClaimsResult {
  claims: Array<typeof CreateClaimBody._output>;
  metadata: {
    sourceTextChars: number;
    extractedTextChars: number;
    promptChars: number;
    truncated: boolean;
    filename: string | null;
  };
}

const SYSTEM_PROMPT = `You convert user-provided career notes, project summaries, and source documents into a Claims Ledger.
Each claim must be an atomic factual unit that can be truthfully used later in resumes and cover letters.

Rules:
1. Do not invent facts, metrics, titles, technologies, employers, dates, or outcomes.
2. If a detail is vague, keep the claim vague instead of making it sound stronger.
3. Split broad experience into multiple precise claims.
4. Put caveats or limitations in disallowedImplications.
5. Use concise tags that improve job matching.
6. Return 3-12 useful claims unless the source supports fewer.

Return ONLY valid JSON with this exact structure:
{
  "claims": [
    {
      "summary": "Single factual claim",
      "evidence": "Short supporting quote or source note",
      "evidenceType": "self_attestation|document",
      "phrasingVariants": ["alternate truthful wording"],
      "disallowedImplications": ["unsupported implication to avoid"],
      "domain": "short professional domain or null",
      "applicableTags": ["tag"],
      "isActive": true
    }
  ]
}`;

export async function draftClaimsFromSource(
  input: DraftClaimsInput,
): Promise<DraftClaimsResult> {
  const combinedSource = [
    input.sourceText.trim() ? `Pasted notes:\n${input.sourceText.trim()}` : "",
    input.extractedText.trim()
      ? `Uploaded document text (${input.filename ?? "uploaded file"}):\n${input.extractedText.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const { text: aiSourceText, truncated } = truncateForAi(combinedSource);
  const evidenceType = input.extractedText.trim() ? "document" : "self_attestation";

  const result = await callAI({
    taskType: "claim_generation",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt:
      `User instruction/context:\n${input.prompt.trim() || "Create factual claims from the provided source material."}\n\n` +
      `Source text${truncated ? ` (truncated to ${MAX_AI_SOURCE_CHARS} characters)` : ""}:\n${aiSourceText}`,
  });

  const parsed = parseJsonResponse<{ claims?: unknown } | unknown[]>(result.content);
  const rawClaims = Array.isArray(parsed) ? parsed : parsed?.claims;

  if (!Array.isArray(rawClaims)) {
    logger.warn({ raw: result.content.slice(0, 500) }, "Claim generation AI response did not include a claims array");
    throw new Error("AI did not return valid claim drafts.");
  }

  const claims = rawClaims.map((raw) => normalizeDraftClaim(raw, evidenceType));
  const parsedClaims = CreateClaimBody.array().safeParse(claims);

  if (!parsedClaims.success || parsedClaims.data.length === 0) {
    logger.warn(
      { error: parsedClaims.success ? null : parsedClaims.error.message },
      "Claim generation produced invalid claim drafts",
    );
    throw new Error("AI returned claim drafts that could not be validated.");
  }

  return {
    claims: parsedClaims.data,
    metadata: {
      sourceTextChars: input.sourceText.length,
      extractedTextChars: input.extractedText.length,
      promptChars: input.prompt.length,
      truncated,
      filename: input.filename,
    },
  };
}

function normalizeDraftClaim(
  raw: unknown,
  evidenceType: "self_attestation" | "document",
): Record<string, unknown> {
  const claim = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

  return {
    summary: typeof claim.summary === "string" ? claim.summary.trim() : "",
    evidence: typeof claim.evidence === "string" ? claim.evidence.trim() : null,
    evidenceType,
    phrasingVariants: normalizeStringArray(claim.phrasingVariants),
    disallowedImplications: normalizeStringArray(claim.disallowedImplications),
    domain: typeof claim.domain === "string" && claim.domain.trim() ? claim.domain.trim() : null,
    applicableTags: normalizeStringArray(claim.applicableTags),
    isActive: typeof claim.isActive === "boolean" ? claim.isActive : true,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
