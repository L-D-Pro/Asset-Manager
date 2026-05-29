import type { MessageAttachment } from "@workspace/db";

export interface ContextRequirementResult {
  hasBaseResume: boolean;
  hasJobContext: boolean;
  hasClaims: boolean;
  warnings: string[];
  blocking: boolean;
}

const JD_SIGNALS = [
  "responsibilities",
  "requirements",
  "qualifications",
  "about the role",
  "job description",
  "preferred",
  "minimum",
  "salary",
  "benefits",
  "location",
];

// minHits=2 for user-message text (long, context-rich); minHits=3 for short documents
// where weak signals like "location"/"preferred"/"minimum" are more likely to collide.
function looksLikeJd(text: string, minHits = 2): boolean {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const sig of JD_SIGNALS) {
    if (lower.includes(sig)) hits++;
    if (hits >= minHits) return true;
  }
  return false;
}

// Any slug containing "tailor" is treated as a resume-tailoring skill.
// This covers: resume_tailoring, resume-tailoring, tailor_resume, tailor-resume, etc.
// Keep slug names in ai_prompt_versions free of "tailor" unless they require resume+JD context.
function isTailoringSlug(slug: string): boolean {
  return slug.toLowerCase().includes("tailor");
}

export function inspectContextRequirements(args: {
  selectedSlugs: string[];
  attachments: MessageAttachment[];
  userMessage: string;
}): ContextRequirementResult {
  const { selectedSlugs, attachments, userMessage } = args;

  // If no resume-tailoring slug is selected, no check is needed — non-blocking.
  const hasTailoringSlug = selectedSlugs.some(isTailoringSlug);
  if (!hasTailoringSlug) {
    return {
      hasBaseResume: true,
      hasJobContext: true,
      // Compute hasClaims accurately even on non-tailoring paths so callers can rely on it.
      hasClaims: attachments.some((a) => a.kind === "claims"),
      warnings: [],
      blocking: false,
    };
  }

  // Check for base resume attachment.
  const hasBaseResume = attachments.some((a) => a.kind === "base_resume");

  // Check for job context: explicit job attachment, JD-like document, or long JD-like user message.
  const hasJobAttachment = attachments.some((a) => a.kind === "job");

  const hasJdDocument =
    attachments.some((a) => {
      if (a.kind !== "document") return false;
      const text = a.snapshot?.contentText;
      if (typeof text !== "string") return false;
      return looksLikeJd(text, 3);
    });

  const hasJdInMessage = userMessage.length > 300 && looksLikeJd(userMessage);

  const hasJobContext = hasJobAttachment || hasJdDocument || hasJdInMessage;

  // Check for claims attachment.
  const hasClaims = attachments.some((a) => a.kind === "claims");

  // Build warnings array.
  const warnings: string[] = [];
  if (!hasBaseResume) {
    warnings.push("Base resume is required for resume tailoring. Please attach or select your base resume.");
  }
  if (!hasJobContext) {
    warnings.push("Job description is required for resume tailoring. Please attach a job or paste the job description.");
  }

  const blocking = !hasBaseResume || !hasJobContext;

  return {
    hasBaseResume,
    hasJobContext,
    hasClaims,
    warnings,
    blocking,
  };
}
