import type { MessageAttachment } from "@workspace/db";

/**
 * Snapshot shapes the chat composer is expected to store inside
 * `messages.attachments[i].snapshot`. These are validated at the route layer
 * (so the chat backend can assume the shapes are well-formed).
 */
export interface BaseResumeSnapshot {
  version?: number;
  capturedAt?: string;
  contentText: string;
}

export interface JobSnapshot {
  title: string;
  company?: string;
  location?: string;
  jdText: string;
}

export interface ClaimSnapshot {
  text: string;
  /** True only if the claim is verified in the ledger. */
  verified: boolean;
}

export interface ClaimsListSnapshot {
  claims: ClaimSnapshot[];
}

export interface DocumentSnapshot {
  filename: string;
  contentText: string;
}

/**
 * Build the "Attached context" markdown block that gets appended to the system
 * prompt. Returns an empty string if there are no attachments — the system
 * prompt composer can then skip the section entirely.
 *
 * Honors a prompt-level truth-lock surrogate: unverified claims are explicitly
 * marked and the model is instructed not to use them in generated output.
 */
export function buildAttachmentsBlock(attachments: MessageAttachment[]): string {
  if (!attachments || attachments.length === 0) return "";

  const sections: string[] = [];
  let hasUnverifiedClaim = false;

  for (const att of attachments) {
    switch (att.kind) {
      case "base_resume": {
        const snap = att.snapshot as Partial<BaseResumeSnapshot>;
        if (!snap.contentText) break;
        const heading = snap.version != null
          ? `### User's base resume (version ${snap.version}${snap.capturedAt ? `, captured ${snap.capturedAt}` : ""})`
          : "### User's base resume";
        sections.push(`${heading}\n\n${snap.contentText.trim()}`);
        break;
      }
      case "job": {
        const snap = att.snapshot as Partial<JobSnapshot>;
        if (!snap.jdText && !snap.title) break;
        const meta: string[] = [];
        if (snap.company) meta.push(`**Company:** ${snap.company}`);
        if (snap.location) meta.push(`**Location:** ${snap.location}`);
        const metaLine = meta.length > 0 ? `\n${meta.join(" · ")}` : "";
        const heading = snap.title
          ? `### Attached job — "${snap.title}"`
          : "### Attached job";
        const body = snap.jdText ? `\n\n**JD:**\n${snap.jdText.trim()}` : "";
        sections.push(`${heading}${metaLine}${body}`);
        break;
      }
      case "claims": {
        const snap = att.snapshot as Partial<ClaimsListSnapshot>;
        const claims = snap.claims ?? [];
        if (claims.length === 0) break;
        const lines = claims.map((c) => {
          if (c.verified) {
            return `- [verified] ${c.text}`;
          }
          hasUnverifiedClaim = true;
          return `- [unverified — DO NOT USE IN OUTPUT] ${c.text}`;
        });
        sections.push(`### Attached claims (${claims.length} selected)\n\n${lines.join("\n")}`);
        break;
      }
      case "document": {
        const snap = att.snapshot as Partial<DocumentSnapshot>;
        if (!snap.contentText) break;
        const heading = snap.filename ? `### Attached document — "${snap.filename}"` : "### Attached document";
        sections.push(`${heading}\n\n${snap.contentText.trim()}`);
        break;
      }
    }
  }

  if (sections.length === 0) return "";

  const truthLockNote = hasUnverifiedClaim
    ? "\n\n> **Truth-lock rule:** Do not include unverified claims in resume or cover-letter output. Reference verified claims only."
    : "";

  return `## Attached context (read-only snapshots)${truthLockNote}\n\n${sections.join("\n\n")}`;
}

export interface ParsedJd {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keywords: string[];
  senioritySignal: string | null;
  location: string | null;
  remoteType: string | null;
}

export function buildParsedJdBlock(jd: ParsedJd): string {
  const lines: string[] = ["## Job Description (pre-parsed — do not re-extract)"];

  if (jd.requiredSkills.length > 0) {
    lines.push(`**Required:** ${jd.requiredSkills.join(", ")}`);
  }
  if (jd.niceToHaveSkills.length > 0) {
    lines.push(`**Nice-to-have:** ${jd.niceToHaveSkills.join(", ")}`);
  }
  if (jd.keywords.length > 0) {
    lines.push(`**Keywords:** ${jd.keywords.join(", ")}`);
  }
  if (jd.senioritySignal) {
    lines.push(`**Seniority:** ${jd.senioritySignal}`);
  }
  if (jd.location) {
    lines.push(`**Location:** ${jd.location}${jd.remoteType ? ` (${jd.remoteType})` : ""}`);
  } else if (jd.remoteType) {
    lines.push(`**Remote type:** ${jd.remoteType}`);
  }

  lines.push("");
  lines.push("> Use this parsed data as the authoritative source. Do not re-extract or re-summarize the raw job posting text.");

  return lines.join("\n");
}
