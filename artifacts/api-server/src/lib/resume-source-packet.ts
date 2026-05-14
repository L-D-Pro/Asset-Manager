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
  kind: "header" | "bullet" | "detail";
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

interface HybridResumeEvidenceMap {
  [lineKey: string]: unknown;
}

interface HybridResumeLineItem {
  text?: unknown;
  sourceRefs?: unknown;
  jobKeywordsUsed?: unknown;
  gapNotes?: unknown;
  confidence?: unknown;
}

interface HybridResumeExperienceEntry {
  title?: unknown;
  company?: unknown;
  location?: unknown;
  dateRange?: unknown;
  sourceRefs?: unknown;
  bullets?: unknown;
}

interface HybridResumeContent {
  summary?: unknown;
  experienceEntries?: unknown;
  projects?: unknown;
  education?: unknown;
  coursework?: unknown;
  involvement?: unknown;
  skills?: unknown;
}

export interface ResumeTailoringPlan {
  sectionItems?: ResumeTailoringPlanItem[];
  summary?: unknown;
  strategy?: unknown;
  content?: HybridResumeContent;
  evidence?: HybridResumeEvidenceMap;
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

export interface PlainTextResumeParseDiagnostics {
  rawLineCount: number;
  parsedLineCount: number;
  validSourceTagCount: number;
  invalidSourceTagCount: number;
  sourceLessLineCount: number;
  sectionCounts: Partial<Record<ResumeSectionKey, number>>;
}

const MAX_BASE_SOURCE_CHARS = 420;
const MAX_BASE_SOURCES = 70;
const MAX_PROMPT_BASE_SOURCES = 45;
const MAX_PROMPT_CLAIMS = 18;

function sanitizeAscii(value: string): string {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function cleanSourceLine(value: string): string {
  return sanitizeAscii(
    stripMarkdownArtifacts(value)
      .text.replace(/^[-*•]\s*/u, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1).trim()}...`;
}

function cleanPromptText(value: string, maxChars: number): string {
  return truncate(
    sanitizeAscii(value)
      .replace(/\s+/g, " ")
      .trim(),
    maxChars,
  );
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

function hasDateSignal(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text);
}

function looksLikeExperienceHeader(text: string): boolean {
  return (
    hasDateSignal(text) &&
    (/\s\|\s/.test(text) || /\s-\s/.test(text) || /\bat\b/i.test(text)) &&
    /(designer|developer|engineer|manager|lead|specialist|analyst|assistant|director|consultant|architect|administrator)/i.test(text)
  );
}

function classifySourceLine(section: ResumeSectionKey, text: string): BaseResumeSource["kind"] {
  if (section === "experience" && looksLikeExperienceHeader(text)) return "header";
  if (/^[-*•]\s*/u.test(text)) return "bullet";
  if (section === "project" && /^[^:]{2,80}:\s+\S/.test(text)) return "header";
  return "detail";
}

export function parseBaseResumeSources(baseResumeText: string): BaseResumeSource[] {
  const stripped = stripMarkdownArtifacts(baseResumeText).text;
  const lines = stripped.split(/\r?\n/);
  const sources: BaseResumeSource[] = [];
  const sectionCounts: Partial<Record<ResumeSectionKey, number>> = {};
  let currentSection: ResumeSectionKey | null = null;
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

    // Skip contact/header lines before the first recognized section heading.
    if (!currentSection) continue;

    const text = cleanSourceLine(line);
    if (!text || text.length < 8) continue;

    const activeSection = currentSection;
    sectionCounts[activeSection] = (sectionCounts[activeSection] ?? 0) + 1;
    const sourceId = `b${String(sectionCounts[activeSection]).padStart(3, "0")}`;
    sources.push({
      ref: `base:${activeSection}:${sourceId}`,
      section: activeSection,
      sourceId,
      text: text.slice(0, MAX_BASE_SOURCE_CHARS),
      kind: classifySourceLine(activeSection, line),
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
        .slice(0, MAX_PROMPT_CLAIMS)
        .map((claim) => {
          const variants = claim.phrasingVariants.length > 0
            ? ` Variants: ${claim.phrasingVariants.slice(0, 3).map((variant) => cleanPromptText(variant, 120)).join(" | ")}.`
            : "";
          const tags = claim.applicableTags.length > 0
            ? ` Tags: ${claim.applicableTags.slice(0, 6).map((tag) => cleanPromptText(tag, 40)).join(", ")}.`
            : "";
          const disallowed = claim.disallowedImplications.length > 0
            ? ` Disallowed implications: ${claim.disallowedImplications.slice(0, 4).map((item) => cleanPromptText(item, 80)).join("; ")}.`
            : "";
          return `${claim.ref} ${cleanPromptText(claim.summary, 260)}${claim.evidence ? ` Evidence: ${cleanPromptText(claim.evidence, 240)}.` : ""}${variants}${tags}${disallowed}`;
        })
        .join("\n")
    : "No selected claims. Use base resume sources only and add gap notes for unsupported job requirements.";

  const base = packet.baseSources
    .slice(0, MAX_PROMPT_BASE_SOURCES)
    .map((source) => `${source.ref} [${source.section}:${source.kind}] ${source.text}`)
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
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function looksLikeDirectiveText(value: string): boolean {
  return /^(highlight|emphasize|include|list|showcase|stress|demonstrate|detail|note|mention|add|outline)\b/i.test(value.trim());
}

function extractSourceTags(line: string): { text: string; sourceRefs: string[]; invalidTagCount: number } {
  const sourceRefs: string[] = [];
  let invalidTagCount = 0;
  const text = line.replace(/\[src:([^\]]+)\]/gi, (_match, rawRefs: string) => {
    const refs = String(rawRefs)
      .split(/[,\s]+/g)
      .map((ref) => ref.trim())
      .filter(Boolean);
    for (const ref of refs) {
      if (/^claim:\d+$/i.test(ref)) {
        sourceRefs.push(ref.toLowerCase());
      } else if (/^base:[a-z_]+:b\d+$/i.test(ref)) {
        sourceRefs.push(ref.toLowerCase());
      } else {
        invalidTagCount++;
      }
    }
    return "";
  });

  return {
    text: cleanSourceLine(text),
    sourceRefs: [...new Set(sourceRefs)],
    invalidTagCount,
  };
}

function rescueUntaggedLine(
  text: string,
  section: ResumeSectionKey,
  baseSources: BaseResumeSource[],
): string[] {
  const needle = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (needle.length < 12) return [];
  const sectionSources = baseSources.filter((s) => s.section === section);
  for (const source of sectionSources) {
    const hay = source.text.toLowerCase().replace(/\s+/g, " ");
    const needleWords = needle.split(" ").filter((w) => w.length > 3);
    if (needleWords.length === 0) continue;
    const matchCount = needleWords.filter((w) => hay.includes(w)).length;
    if (matchCount / needleWords.length >= 0.4) {
      return [source.ref];
    }
  }
  return [];
}

export function parsePlainTextResumeDraft(
  content: string,
  packet: ResumeSourcePacket,
): { items: ValidatedResumeItem[]; validation: ResumeSourceValidation; diagnostics: PlainTextResumeParseDiagnostics } {
  const stripped = stripMarkdownArtifacts(sanitizeAscii(content)).text;
  const lines = stripped.split(/\r?\n/);
  const sectionCounts: Partial<Record<ResumeSectionKey, number>> = {};
  const sectionItems: ResumeTailoringPlanItem[] = [];
  let currentSection: ResumeSectionKey | null = null;
  let sawSection = false;
  let rawLineCount = 0;
  let validSourceTagCount = 0;
  let invalidSourceTagCount = 0;
  let sourceLessLineCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    rawLineCount++;

    const withoutTag = line.replace(/\[src:[^\]]+\]/gi, "").trim();
    const section = headingToSection(withoutTag);
    const looksLikeUnknownHeading = /^[A-Z][A-Z0-9 &/.-]{2,}$/.test(withoutTag.replace(/[:\s]+$/g, ""));
    if (section) {
      currentSection = section;
      sawSection = true;
      continue;
    }
    if (looksLikeUnknownHeading && sawSection) {
      currentSection = null;
      continue;
    }
    if (!currentSection) continue;

    const extracted = extractSourceTags(line);
    invalidSourceTagCount += extracted.invalidTagCount;
    validSourceTagCount += extracted.sourceRefs.length;
    if (extracted.sourceRefs.length === 0) {
      sourceLessLineCount++;
    }
    if (!extracted.text || extracted.text.length < 8) continue;

    sectionCounts[currentSection] = (sectionCounts[currentSection] ?? 0) + 1;
    sectionItems.push({
      section: currentSection,
      text: extracted.text,
      sourceRefs: extracted.sourceRefs,
      jobKeywordsUsed: [],
      gapNotes: [],
    });
  }

  // When every line lacked source tags (model ignored format), attempt fuzzy rescue by
  // matching line text against base resume sources to recover attributable content.
  if (validSourceTagCount === 0 && sectionItems.length > 0) {
    for (const item of sectionItems) {
      const refs = stringArray(item.sourceRefs);
      if (refs.length === 0) {
        const section = normalizeResumeSection(item.section) ?? "experience";
        const rescued = rescueUntaggedLine(String(item.text ?? ""), section, packet.baseSources);
        if (rescued.length > 0) {
          (item as ResumeTailoringPlanItem & { sourceRefs: string[] }).sourceRefs = rescued;
        }
      }
    }
  }

  const result = validateResumeTailoringPlan({ sectionItems, summary: "plain_text_v1" }, packet);
  return {
    ...result,
    diagnostics: {
      rawLineCount,
      parsedLineCount: sectionItems.length,
      validSourceTagCount,
      invalidSourceTagCount,
      sourceLessLineCount,
      sectionCounts,
    },
  };
}

function toResumePlanItem(args: {
  section: ResumeSectionKey;
  text: string;
  sourceRefs?: unknown;
  jobKeywordsUsed?: unknown;
  gapNotes?: unknown;
}): ResumeTailoringPlanItem {
  return {
    section: args.section,
    text: args.text,
    sourceRefs: stringArray(args.sourceRefs),
    jobKeywordsUsed: stringArray(args.jobKeywordsUsed),
    gapNotes: stringArray(args.gapNotes),
  };
}

function experienceHeaderFromEntry(entry: HybridResumeExperienceEntry): string {
  const title = typeof entry.title === "string" ? cleanSourceLine(entry.title) : "";
  const company = typeof entry.company === "string" ? cleanSourceLine(entry.company) : "";
  const location = typeof entry.location === "string" ? cleanSourceLine(entry.location) : "";
  const dateRange = typeof entry.dateRange === "string" ? cleanSourceLine(entry.dateRange) : "";
  const parts = [title, company, location, dateRange].filter((part) => part.length > 0);
  return parts.join(" | ");
}

function rawTextList(value: unknown): Array<{
  text: string;
  sourceRefs?: unknown;
  jobKeywordsUsed?: unknown;
  gapNotes?: unknown;
}> {
  if (typeof value === "string") {
    return [{ text: cleanSourceLine(value) }];
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { text: cleanSourceLine(item) };
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const candidate = item as HybridResumeLineItem;
      const text = typeof candidate.text === "string" ? cleanSourceLine(candidate.text) : "";
      if (!text) return null;
      return {
        text,
        sourceRefs: candidate.sourceRefs,
        jobKeywordsUsed: candidate.jobKeywordsUsed,
        gapNotes: candidate.gapNotes,
      };
    })
    .filter((item): item is { text: string; sourceRefs?: unknown; jobKeywordsUsed?: unknown; gapNotes?: unknown } => item != null && item.text.length > 0);
}

function extractHybridPlanItems(plan: ResumeTailoringPlan): ResumeTailoringPlanItem[] {
  const content = plan.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];

  const items: ResumeTailoringPlanItem[] = [];
  for (const line of rawTextList(content.summary)) {
    items.push(toResumePlanItem({ section: "summary", ...line }));
  }

  const experienceEntries = Array.isArray(content.experienceEntries) ? (content.experienceEntries as HybridResumeExperienceEntry[]) : [];
  for (const entry of experienceEntries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const header = experienceHeaderFromEntry(entry);
    if (header.length > 0) {
      items.push(
        toResumePlanItem({
          section: "experience",
          text: header,
          sourceRefs: entry.sourceRefs,
        }),
      );
    }
    const bullets = Array.isArray(entry.bullets) ? entry.bullets : [];
    for (const bullet of rawTextList(bullets)) {
      items.push(toResumePlanItem({ section: "experience", ...bullet }));
    }
  }

  for (const line of rawTextList(content.projects)) {
    items.push(toResumePlanItem({ section: "project", ...line }));
  }
  for (const line of rawTextList(content.education)) {
    items.push(toResumePlanItem({ section: "education", ...line }));
  }
  for (const line of rawTextList(content.coursework)) {
    items.push(toResumePlanItem({ section: "coursework", ...line }));
  }
  for (const line of rawTextList(content.involvement)) {
    items.push(toResumePlanItem({ section: "involvement", ...line }));
  }
  for (const line of rawTextList(content.skills)) {
    items.push(toResumePlanItem({ section: "skills", ...line }));
  }

  return items;
}

export function validateResumeTailoringPlan(
  plan: ResumeTailoringPlan | null,
  packet: ResumeSourcePacket,
): { items: ValidatedResumeItem[]; validation: ResumeSourceValidation } {
  const safePlan = plan ?? {};
  const claimRefs = new Map(packet.claims.map((claim) => [claim.ref, claim.id]));
  const baseRefs = new Set(packet.baseSources.map((source) => source.ref));
  const allowedSections = new Set(packet.allowedSections);
  const hybridItems = extractHybridPlanItems(safePlan);
  const rawItems =
    Array.isArray(safePlan.sectionItems) && safePlan.sectionItems.length > 0
      ? safePlan.sectionItems
      : hybridItems;
  const items: ValidatedResumeItem[] = [];
  const invalidItems: ResumeSourceValidation["invalidItems"] = [];
  const evidenceMap =
    safePlan.evidence && typeof safePlan.evidence === "object" && !Array.isArray(safePlan.evidence)
      ? (safePlan.evidence as HybridResumeEvidenceMap)
      : {};

  for (const raw of rawItems) {
    const text = typeof raw.text === "string" ? cleanSourceLine(raw.text) : "";
    const section = normalizeResumeSection(raw.section) ?? null;
    const sourceRefsFromRaw = stringArray(raw.sourceRefs);
    const evidenceRefs = stringArray(evidenceMap[text]);
    const sourceRefs = sourceRefsFromRaw.length > 0 ? sourceRefsFromRaw : evidenceRefs;
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
    if (looksLikeDirectiveText(text)) {
      invalidItems.push({ text, reason: "Directive-style text is not renderable resume content", sourceRefs });
      continue;
    }
    if (!section || !allowedSections.has(section)) {
      invalidItems.push({
        text,
        reason: `Section is not allowed by selected template: ${String(raw.section ?? "")}`,
        sourceRefs,
      });
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
  const validityRatio = rawItems.length > 0 ? items.length / rawItems.length : 0;
  const hasExperience = items.some((item) => item.section === "experience");
  return {
    items,
    validation: {
      passed: items.length > 0 && (validityRatio >= 0.35 || hasExperience),
      validItemCount: items.length,
      invalidItemCount: invalidItems.length,
      claimBackedCount,
      baseBackedCount,
      invalidItems,
    },
  };
}
