import type { Claim } from "@workspace/db";

export type ResumeTemplateId =
  | "student_technical_assistant"
  | "software_developer"
  | "data_engineer";

export type ResumeSectionKey =
  | "summary"
  | "experience"
  | "project"
  | "education"
  | "coursework"
  | "involvement"
  | "skills";

export interface ResumeTemplateMetadata {
  id: ResumeTemplateId;
  label: string;
  description: string;
  roleFit: string[];
  sectionOrder: ResumeSectionKey[];
  lengthPolicy: {
    target: string;
    maxPages: number;
    maxBulletLines: number;
  };
}

export interface TemplateBullet {
  text: string;
  section?: unknown;
  claimIds?: unknown;
  jobKeywordsUsed?: unknown;
  sourceMap?: unknown;
}

export interface ResumeTemplateValidation {
  templateId: ResumeTemplateId;
  templateLabel: string;
  allowedSections: ResumeSectionKey[];
  omittedSections: string[];
  markdownArtifactsRemoved: string[];
  trimmedBulletCount: number;
  renderedBulletCount: number;
  lengthPolicy: ResumeTemplateMetadata["lengthPolicy"];
}

export const DEFAULT_RESUME_TEMPLATE_ID: ResumeTemplateId = "software_developer";

const COMMON_LENGTH_POLICY = {
  target: "Concise 1-2 pages",
  maxPages: 2,
  maxBulletLines: 30,
};

export const RESUME_TEMPLATES: ResumeTemplateMetadata[] = [
  {
    id: "student_technical_assistant",
    label: "Student Technical Assistant",
    description: "ATS-friendly early-career format with coursework and involvement sections.",
    roleFit: ["student roles", "technical assistant", "internship", "early career"],
    sectionOrder: ["summary", "experience", "education", "coursework", "involvement", "skills"],
    lengthPolicy: COMMON_LENGTH_POLICY,
  },
  {
    id: "software_developer",
    label: "Software Developer",
    description: "Technical role format with project evidence before education and skills.",
    roleFit: ["software developer", "frontend", "backend", "full stack", "technical product"],
    sectionOrder: ["summary", "experience", "project", "education", "skills"],
    lengthPolicy: COMMON_LENGTH_POLICY,
  },
  {
    id: "data_engineer",
    label: "Data Engineer",
    description: "Data and analytics format with technical experience, education, and involvement.",
    roleFit: ["data engineer", "analytics engineer", "BI", "ETL", "data platform"],
    sectionOrder: ["summary", "experience", "education", "involvement", "skills"],
    lengthPolicy: COMMON_LENGTH_POLICY,
  },
];

const SECTION_ALIASES: Record<string, ResumeSectionKey> = {
  professional_summary: "summary",
  profile: "summary",
  objective: "summary",
  professional_experience: "experience",
  work_experience: "experience",
  employment: "experience",
  projects: "project",
  selected_projects: "project",
  selected_learning_technology_projects: "project",
  technical_projects: "project",
  core_competencies: "skills",
  technical_skills: "skills",
  certifications: "education",
  education_certifications: "education",
  education_and_certifications: "education",
  volunteer: "involvement",
  leadership: "involvement",
  extracurricular: "involvement",
};

const KNOWN_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: "SUMMARY",
  experience: "EXPERIENCE",
  project: "PROJECT",
  education: "EDUCATION",
  coursework: "COURSEWORK",
  involvement: "INVOLVEMENT",
  skills: "SKILLS",
};

export function listResumeTemplates(): ResumeTemplateMetadata[] {
  return RESUME_TEMPLATES;
}

export function getResumeTemplate(templateId?: string | null): ResumeTemplateMetadata {
  return (
    RESUME_TEMPLATES.find((template) => template.id === templateId) ??
    RESUME_TEMPLATES.find((template) => template.id === DEFAULT_RESUME_TEMPLATE_ID)!
  );
}

export function isResumeTemplateId(value: unknown): value is ResumeTemplateId {
  return typeof value === "string" && RESUME_TEMPLATES.some((template) => template.id === value);
}

export function normalizeResumeSection(value: unknown): ResumeSectionKey | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if ((Object.keys(KNOWN_SECTION_LABELS) as ResumeSectionKey[]).includes(normalized as ResumeSectionKey)) {
    return normalized as ResumeSectionKey;
  }

  return SECTION_ALIASES[normalized] ?? null;
}

export function stripMarkdownArtifacts(text: string): { text: string; removed: string[] } {
  const removed = new Set<string>();
  let clean = text;

  if (/```/.test(clean)) removed.add("code fences");
  clean = clean.replace(/```(?:json|text)?/gi, "").replace(/```/g, "");

  if (/\*\*/.test(clean)) removed.add("bold markers");
  clean = clean.replace(/\*\*/g, "");

  if (/^\s{0,3}#{1,6}\s+/m.test(clean)) removed.add("markdown headings");
  clean = clean.replace(/^\s{0,3}#{1,6}\s+/gm, "");

  if (/^\s*[-*]\s+/m.test(clean)) removed.add("markdown bullets");
  clean = clean.replace(/^\s*[-*]\s+/gm, "");

  if (/^\s*[-*]\s*([^:\n]{2,40}):\s*/m.test(clean)) removed.add("markdown label bullets");
  clean = clean.replace(/^\s*[-*]\s*([^:\n]{2,40}):\s*/gm, "$1: ");

  clean = clean
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: clean, removed: Array.from(removed) };
}

function normalizeLine(text: string): string {
  return stripMarkdownArtifacts(String(text ?? ""))
    .text.replace(/^[-*•]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingToSection(line: string): ResumeSectionKey | null {
  const stripped = line.replace(/[:\s]+$/g, "");
  return normalizeResumeSection(stripped);
}

function sanitizeAscii(value: string): string {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
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

function looksLikeProjectHeader(text: string): boolean {
  return /^[^:]{2,80}:\s+\S/.test(text);
}

function extractSections(text: string): {
  headerLines: string[];
  sections: Partial<Record<ResumeSectionKey, string[]>>;
  unknownSections: string[];
} {
  const lines = stripMarkdownArtifacts(text).text.split(/\r?\n/);
  const headerLines: string[] = [];
  const sections: Partial<Record<ResumeSectionKey, string[]>> = {};
  const unknownSections: string[] = [];
  let current: ResumeSectionKey | null = null;
  let sawSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const section = headingToSection(line);
    const looksLikeHeading = /^[A-Z][A-Z0-9 &/.-]{2,}$/.test(line.replace(/[:\s]+$/g, ""));
    if (section) {
      current = section;
      sawSection = true;
      sections[current] ??= [];
      continue;
    }

    if (looksLikeHeading && sawSection) {
      unknownSections.push(line.replace(/[:\s]+$/g, ""));
      current = null;
      continue;
    }

    if (!sawSection) {
      headerLines.push(line);
      continue;
    }

    if (current) {
      sections[current] ??= [];
      sections[current]!.push(line);
    }
  }

  return { headerLines, sections, unknownSections };
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const clean = normalizeLine(line);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function scoreBullet(bullet: TemplateBullet): number {
  const text = normalizeLine(bullet.text);
  const claimCount = Array.isArray(bullet.claimIds) ? bullet.claimIds.length : 0;
  const keywordCount = Array.isArray(bullet.jobKeywordsUsed) ? bullet.jobKeywordsUsed.length : 0;
  const metricBoost = /\b\d+(?:[.,]\d+)?%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(text)
    ? 2
    : 0;
  const headerBoost = looksLikeExperienceHeader(text) ? 10 : 0;
  return headerBoost + claimCount * 5 + keywordCount * 2 + metricBoost + Math.min(text.length / 120, 2);
}

function chooseBulletsForTemplate(args: {
  template: ResumeTemplateMetadata;
  bullets: TemplateBullet[];
}): { bullets: TemplateBullet[]; omittedSections: string[]; trimmedBulletCount: number } {
  const allowed = new Set(args.template.sectionOrder);
  const omittedSections = new Set<string>();
  const sectioned: Partial<Record<ResumeSectionKey, TemplateBullet[]>> = {};

  for (const bullet of args.bullets) {
    const section = normalizeResumeSection(bullet.section) ?? "experience";
    if (!allowed.has(section)) {
      omittedSections.add(String(bullet.section ?? "unknown"));
      continue;
    }
    sectioned[section] ??= [];
    sectioned[section]!.push({ ...bullet, section });
  }

  const selected: TemplateBullet[] = [];
  for (const section of args.template.sectionOrder) {
    const bullets = (sectioned[section] ?? []).filter((bullet) => normalizeLine(bullet.text));
    selected.push(...bullets);
  }

  const kept = selected.length <= args.template.lengthPolicy.maxBulletLines
    ? selected
    : selected
        .map((bullet, index) => ({ bullet, index, score: scoreBullet(bullet) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, args.template.lengthPolicy.maxBulletLines)
        .sort((a, b) => a.index - b.index)
        .map((item) => item.bullet);
  return {
    bullets: kept,
    omittedSections: Array.from(omittedSections),
    trimmedBulletCount: Math.max(0, selected.length - kept.length),
  };
}

function renderSectionLines(section: ResumeSectionKey, lines: string[]): string[] {
  if (section === "summary") return [lines.join(" ")];

  if (section === "experience") {
    const output: string[] = [];
    for (const line of lines) {
      if (looksLikeExperienceHeader(line)) {
        if (output.length > 0) output.push("");
        output.push(line);
      } else {
        output.push(`- ${line}`);
      }
    }
    return output;
  }

  if (section === "project") {
    return lines.map((line) => (looksLikeProjectHeader(line) ? line : `- ${line}`));
  }

  return lines.map((line) => `- ${line}`);
}

export function renderResumePlainText(args: {
  templateId?: string | null;
  baseResumeText?: string | null;
  documentText?: string | null;
  bullets?: TemplateBullet[] | null;
}): { text: string; validation: ResumeTemplateValidation } {
  const template = getResumeTemplate(args.templateId);
  const sourceText = args.documentText || args.baseResumeText || "";
  const stripped = stripMarkdownArtifacts(sourceText);
  const extracted = extractSections(stripped.text);
  const chosen = chooseBulletsForTemplate({
    template,
    bullets: args.bullets ?? [],
  });

  const bySection: Partial<Record<ResumeSectionKey, string[]>> = {};
  for (const bullet of chosen.bullets) {
    const section = normalizeResumeSection(bullet.section) ?? "experience";
    bySection[section] ??= [];
    bySection[section]!.push(normalizeLine(bullet.text));
  }

  const output: string[] = [];
  const headerLines = uniqueLines(extracted.headerLines).slice(0, 4);
  if (headerLines.length > 0) {
    output.push(...headerLines, "");
  }

  for (const section of template.sectionOrder) {
    const sectionLines =
      bySection[section] && bySection[section]!.length > 0
        ? uniqueLines(bySection[section]!)
        : uniqueLines(extracted.sections[section] ?? []);

    if (sectionLines.length === 0) continue;

    output.push(KNOWN_SECTION_LABELS[section]);
    output.push(...renderSectionLines(section, sectionLines));
    output.push("");
    continue;
    if (section === "summary") {
      output.push(sectionLines.join(" "));
    } else {
      output.push(...sectionLines.map((line) => `• ${line}`));
    }
    output.push("");
  }

  const text = sanitizeAscii(output.join("\n").replace(/\n{3,}/g, "\n\n").trim());
  return {
    text,
    validation: {
      templateId: template.id,
      templateLabel: template.label,
      allowedSections: template.sectionOrder,
      omittedSections: Array.from(new Set([...chosen.omittedSections, ...extracted.unknownSections])),
      markdownArtifactsRemoved: stripped.removed,
      trimmedBulletCount: chosen.trimmedBulletCount,
      renderedBulletCount: chosen.bullets.length,
      lengthPolicy: template.lengthPolicy,
    },
  };
}

export function formatTemplatePrompt(template: ResumeTemplateMetadata): string {
  return [
    `Selected resume template: ${template.label} (${template.id}).`,
    `Allowed section order: ${template.sectionOrder.map((section) => KNOWN_SECTION_LABELS[section]).join(" > ")}.`,
    `Length target: ${template.lengthPolicy.target}; hard cap ${template.lengthPolicy.maxPages} pages.`,
    "Return structured content only. Do not author markdown or visual formatting.",
  ].join("\n");
}

export function describeClaimsForTemplate(claims: Claim[]): string {
  return claims
    .map((claim) => {
      const disallowed = Array.isArray(claim.disallowedImplications) && claim.disallowedImplications.length > 0
        ? ` Disallowed implications: ${claim.disallowedImplications.join("; ")}.`
        : "";
      return `[ID:${claim.id}] ${claim.summary}${claim.evidence ? ` (Evidence: ${claim.evidence})` : ""}${disallowed}`;
    })
    .join("\n");
}
