import type { Claim } from "@workspace/db";
import {
  getResumeTemplate,
  normalizeResumeSection,
  stripMarkdownArtifacts,
  type ResumeSectionKey,
  type ResumeTemplateId,
  type TemplateBullet,
} from "./resume-templates";

export interface BaseResumeSource {
  ref: string;
  section: ResumeSectionKey;
  sourceId: string;
  text: string;
}

export interface ResumeSourcePacket {
  templateId: ResumeTemplateId;
  templateLabel: string;
  allowedSections: ResumeSectionKey[];
  baseSources: BaseResumeSource[];
  claims: Array<{
    ref: string;
    id: number;
    summary: string;
    evidence: string | null;
    phrasingVariants: string[];
    applicableTags: string[];
    disallowedImplications: string[];
  }>;
}

export interface ResumeTailoringPlanItem {
  section?: unknown;
  text?: unknown;
  sourceRefs?: unknown;
  jobKeywordsUsed?: unknown;
  gapNotes?: unknown;
}

export interface ResumeTailoringPlan {
  sectionItems?: ResumeTailoringPlanItem[];
  summary?: unknown;
}

export interface ValidatedResumeItem extends TemplateBullet {
  text: string;
  section: ResumeSectionKey;
  claimIds: number[];
  sourceRefs: string[];
  baseSourceRefs: string[];
  jobKeywordsUsed: string[];
  gapNotes: string[];
  sourceMap: {
    sourceRefs: string[];
    sourceClaimIds: number[];
    baseSourceRefs: string[];
  };
}

export interface ResumeSourceValidation {
  passed: boolean;
  validItemCount: number;
  invalidItemCount: number;
  claimBackedCount: number;
  baseBackedCount: number;
  invalidItems: Array<{
    text: string;
    reason: string;
    sourceRefs: string[];
  }>;
}

const MAX_BASE_SOURCE_CHARS = 700;
const MAX_BASE_SOURCES = 120;

function cleanSourceLine(value: string): string {
  return stripMarkdownArtifacts(value)
    .text.replace(/^[-*•]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingToSection(line: string): ResumeSectionKey | null {
  const stripped = line
    .replace(/^[-*•]\s*/u, "")
    .replace(/[:\s]+$/g, "")
    .trim();
  const section = normalizeResumeSection(stripped);
  if (section) return section;
  return /^[A-Z][A-Z0-9 &/.-]{2,}$/.test(stripped) ? null : null;
}

export function parseBaseResumeSources(baseResumeText: string): BaseResumeSource[] {
  const stripped = stripMarkdownArtifacts(baseResumeText).text;
  const lines = stripped.split(/\r?\n/);
  const sources: BaseResumeSource[] = [];
  const sectionCounts: Partial<Record<ResumeSectionKey, number>> = {};
  let currentSection: ResumeSectionKey = "summary";
  let sawSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const section = headingToSection(line);
    if (section) {
      currentSection = section;
      sawSection = true;
      continue;
    }

    const looksLikeUnknownHeading = /^[A-Z][A-Z0-9 &/.-]{2,}$/.test(line.replace(/[:\s]+$/g, ""));
    if (looksLikeUnknownHeading && sawSection) continue;

    const text = cleanSourceLine(line);
    if (!text || text.length < 8) continue;

    sectionCounts[currentSection] = (sectionCounts[currentSection] ?? 0) + 1;
    const sourceId = `b${String(sectionCounts[currentSection]).padStart(3, "0")}`;
    sources.push({
      ref: `base:${currentSection}:${sourceId}`,
      section: currentSection,
      sourceId,
      text: text.slice(0, MAX_BASE_SOURCE_CHARS),
    });

    if (sources.length >= MAX_BASE_SOURCES) break;
  }

  return sources;
}

export function buildResumeSourcePacket(args: {
  baseResumeText: string;
  claims: Claim[];
  templateId?: string | null;
}): ResumeSourcePacket {
  const template = getResumeTemplate(args.templateId);
  return {
    templateId: template.id,
    templateLabel: template.label,
    allowedSections: template.sectionOrder,
    baseSources: parseBaseResumeSources(args.baseResumeText),
    claims: args.claims.map((claim) => ({
      ref: `claim:${claim.id}`,
      id: claim.id,
      summary: claim.summary,
      evidence: claim.evidence ?? null,
      phrasingVariants: claim.phrasingVariants ?? [],
      applicableTags: claim.applicableTags ?? [],
      disallowedImplications: claim.disallowedImplications ?? [],
    })),
  };
}

export function formatResumeSourcePacketForPrompt(packet: ResumeSourcePacket): string {
  const claims = packet.claims.length > 0
    ? packet.claims
        .map((claim) => {
          const variants = claim.phrasingVariants.length > 0 ? ` Variants: ${claim.phrasingVariants.join(" | ")}.` : "";
          const tags = claim.applicableTags.length > 0 ? ` Tags: ${claim.applicableTags.join(", ")}.` : "";
          const disallowed = claim.disallowedImplications.length > 0
            ? ` Disallowed implications: ${claim.disallowedImplications.join("; ")}.`
            : "";
          return `${claim.ref} ${claim.summary}${claim.evidence ? ` Evidence: ${claim.evidence}.` : ""}${variants}${tags}${disallowed}`;
        })
        .join("\n")
    : "No selected claims. Use base resume sources only and add gap notes for unsupported job requirements.";

  const base = packet.baseSources
    .map((source) => `${source.ref} [${source.section}] ${source.text}`)
    .join("\n");

  return [
    `Template: ${packet.templateLabel} (${packet.templateId})`,
    `Allowed sections: ${packet.allowedSections.join(", ")}`,
    "",
    "CLAIM SOURCES",
    claims,
    "",
    "BASE RESUME SOURCES",
    base || "No base resume source snippets were parsed.",
  ].join("\n");
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

export function validateResumeTailoringPlan(
  plan: ResumeTailoringPlan | null,
  packet: ResumeSourcePacket,
): { items: ValidatedResumeItem[]; validation: ResumeSourceValidation } {
  const claimRefs = new Map(packet.claims.map((claim) => [claim.ref, claim.id]));
  const baseRefs = new Set(packet.baseSources.map((source) => source.ref));
  const allowedSections = new Set(packet.allowedSections);
  const rawItems = Array.isArray(plan?.sectionItems) ? plan!.sectionItems : [];
  const items: ValidatedResumeItem[] = [];
  const invalidItems: ResumeSourceValidation["invalidItems"] = [];

  for (const raw of rawItems) {
    const text = typeof raw.text === "string" ? cleanSourceLine(raw.text) : "";
    const section = normalizeResumeSection(raw.section) ?? null;
    const sourceRefs = stringArray(raw.sourceRefs);
    const validClaimIds: number[] = [];
    const validBaseRefs: string[] = [];

    for (const ref of sourceRefs) {
      const claimId = claimRefs.get(ref);
      if (claimId != null) {
        validClaimIds.push(claimId);
      } else if (baseRefs.has(ref)) {
        validBaseRefs.push(ref);
      }
    }

    if (!text) {
      invalidItems.push({ text: "", reason: "Missing text", sourceRefs });
      continue;
    }
    if (!section || !allowedSections.has(section)) {
      invalidItems.push({ text, reason: `Section is not allowed by selected template: ${String(raw.section ?? "")}`, sourceRefs });
      continue;
    }
    if (validClaimIds.length === 0 && validBaseRefs.length === 0) {
      invalidItems.push({ text, reason: "No valid claim or base resume source reference", sourceRefs });
      continue;
    }

    const uniqueClaimIds = [...new Set(validClaimIds)];
    const uniqueBaseRefs = [...new Set(validBaseRefs)];
    const validRefs = [...uniqueClaimIds.map((id) => `claim:${id}`), ...uniqueBaseRefs];
    items.push({
      text,
      section,
      claimIds: uniqueClaimIds,
      sourceRefs: validRefs,
      baseSourceRefs: uniqueBaseRefs,
      jobKeywordsUsed: stringArray(raw.jobKeywordsUsed),
      gapNotes: stringArray(raw.gapNotes),
      sourceMap: {
        sourceRefs: validRefs,
        sourceClaimIds: uniqueClaimIds,
        baseSourceRefs: uniqueBaseRefs,
      },
    });
  }

  const claimBackedCount = items.filter((item) => item.claimIds.length > 0).length;
  const baseBackedCount = items.filter((item) => item.baseSourceRefs.length > 0).length;
  return {
    items,
    validation: {
      passed: items.length > 0 && invalidItems.length === 0,
      validItemCount: items.length,
      invalidItemCount: invalidItems.length,
      claimBackedCount,
      baseBackedCount,
      invalidItems,
    },
  };
}
