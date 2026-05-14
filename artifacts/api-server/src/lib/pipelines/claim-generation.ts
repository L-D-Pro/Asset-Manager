import { CreateClaimBody } from "@workspace/api-zod";
import { callAI, parseJsonResponse } from "../ai-client";
import { MAX_AI_SOURCE_CHARS, truncateForAi } from "../document-text";
import { logger } from "../logger";

export class ClaimDraftingUnavailableError extends Error {
  readonly retryable = true;
  constructor() {
    super(
      "AI claim drafting is temporarily unavailable. Please retry, or paste claims manually.",
    );
    this.name = "ClaimDraftingUnavailableError";
  }
}

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

Prefer valid JSON with this exact structure:
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
}

If JSON is difficult for the model/provider, return one claim per line instead. Each line must still be a factual claim, not advice.`;

const CLAIM_GENERATION_TIMEOUT_MS = 25_000;
const CLAIM_GENERATION_MAX_TOKENS = 1_800;
const CLAIM_GENERATION_MAX_ATTEMPTS = 1;

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

  const aiClaims = await draftClaimsWithAi({
    aiSourceText,
    truncated,
    prompt: input.prompt,
    evidenceType,
  });

  if (aiClaims.length === 0) {
    logger.warn(
      {
        sourceTextChars: input.sourceText.length,
        extractedTextChars: input.extractedText.length,
        filename: input.filename,
      },
      "Claim generation AI returned no usable claims; surfacing error to user",
    );
    throw new ClaimDraftingUnavailableError();
  }

  const parsedClaims = CreateClaimBody.array().safeParse(aiClaims);

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

async function draftClaimsWithAi(args: {
  aiSourceText: string;
  truncated: boolean;
  prompt: string;
  evidenceType: "self_attestation" | "document";
}): Promise<Array<Record<string, unknown>>> {
  try {
    const result = await callAI({
      taskType: "claim_generation",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt:
        `User instruction/context:\n${args.prompt.trim() || "Create factual claims from the provided source material."}\n\n` +
        `Source text${args.truncated ? ` (truncated to ${MAX_AI_SOURCE_CHARS} characters)` : ""}:\n${args.aiSourceText}`,
      extraParams: {
        maxAttempts: CLAIM_GENERATION_MAX_ATTEMPTS,
        timeoutMs: CLAIM_GENERATION_TIMEOUT_MS,
        max_tokens: CLAIM_GENERATION_MAX_TOKENS,
        temperature: 0.2,
      },
      validateContent: (content) => {
        if (!content.trim()) {
          throw new Error("empty_model_content: claim generation returned no text");
        }
      },
    });

    const rawClaims = parseAiClaimDrafts(result.content);
    if (rawClaims.length === 0) {
      logger.warn(
        {
          raw: result.content.slice(0, 500),
          modelName: result.modelName,
          finishReason: result.finishReason,
        },
        "Claim generation AI response did not include parseable claim drafts",
      );
      return [];
    }

    return rawClaims.map((raw) => normalizeDraftClaim(raw, args.evidenceType));
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Claim generation AI path failed; falling back to deterministic claim drafts",
    );
    return [];
  }
}

function parseAiClaimDrafts(content: string): unknown[] {
  const parsed = parseJsonResponse<{ claims?: unknown } | unknown[]>(content);
  const rawClaims = Array.isArray(parsed) ? parsed : parsed?.claims;
  if (Array.isArray(rawClaims)) return rawClaims;
  return parseLineOrientedClaimDrafts(content);
}

function parseLineOrientedClaimDrafts(content: string): unknown[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => sanitizeClaimText(line))
    .filter((line) => isUsefulClaimLine(line))
    .slice(0, 12);

  return lines.map((line) => ({
    summary: line,
    evidence: line,
    evidenceType: "self_attestation",
    phrasingVariants: [],
    disallowedImplications: [],
    domain: inferDomain(line),
    applicableTags: inferTags(line),
    isActive: true,
  }));
}

function sanitizeClaimText(value: string): string {
  return value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/^\s*\d+[\).]\s*/, "")
    .replace(/^\s*["']|["']\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulClaimLine(line: string): boolean {
  if (line.length < 24 || line.length > 360) return false;
  if (/^(summary|experience|education|skills|projects|claims?|drafts?)$/i.test(line)) return false;
  if (/^(highlight|include|mention|emphasize|showcase|focus on)\b/i.test(line)) return false;
  if (!/[a-z]/i.test(line)) return false;
  return true;
}

function inferDomain(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(ai|llm|automation|generative)\b/.test(lower)) return "ai";
  if (/\b(lms|scorm|xapi|storyline|captivate|instructional|learning|training)\b/.test(lower)) {
    return "learning_development";
  }
  if (/\b(cybersecurity|security|phishing|hipaa|compliance)\b/.test(lower)) return "compliance";
  if (/\b(project|portfolio|platform|application|cloud)\b/.test(lower)) return "projects";
  return null;
}

function inferTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();
  const knownTags = [
    "instructional design",
    "learning development",
    "addie",
    "sam",
    "agile",
    "section 508",
    "wcag",
    "lms",
    "scorm",
    "xapi",
    "articulate storyline",
    "captivate",
    "ai",
    "llm",
    "automation",
    "cybersecurity",
    "hipaa",
    "compliance",
    "moodle",
    "canvas",
    "healthcare",
  ];

  for (const tag of knownTags) {
    if (lower.includes(tag)) tags.add(tag);
  }

  return [...tags].slice(0, 10);
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
