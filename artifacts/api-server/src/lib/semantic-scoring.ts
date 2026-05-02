import type { Job } from "@workspace/db";
import { callAI, parseJsonResponse } from "./ai-client";
import { buildGapAnalysisPrompt } from "./prompts/gap-analysis";

export interface SkillMatch {
  skill: string;
  resumeEvidence: string;
  jobRequired: boolean;
  matchType: "exact" | "synonym" | "related" | "missing";
}

export interface ExperienceMatch {
  category: string;
  resumeYears: number;
  jobRequiredYears: number;
  matchScore: number; // 0-1
}

export interface EducationMatch {
  resumeEducation: string;
  jobRequiredEducation: string;
  matchType: "exact" | "equivalent" | "partial" | "missing";
  equivalents: string[]; // e.g., ["B.A.", "Bachelor's Degree", "BS"]
}

export interface ScoringResult {
  overallScore: number; // 0-100
  breakdown: {
    skillsScore: number;
    experienceScore: number;
    educationScore: number;
    keywordScore: number;
  };
  matches: {
    skills: SkillMatch[];
    experience: ExperienceMatch[];
    education: EducationMatch[];
    keywords: { term: string; found: boolean; context?: string }[];
  };
  gaps: {
    missingSkills: string[];
    missingExperience: string[];
    missingEducation: string[];
    missingKeywords: string[];
  };
  suggestions: string[]; // actionable improvement suggestions
  semanticRationale: string; // human-readable explanation
}

function isValidMatchType(v: unknown): v is SkillMatch["matchType"] {
  return v === "exact" || v === "synonym" || v === "related" || v === "missing";
}

function isValidEducationMatchType(
  v: unknown,
): v is EducationMatch["matchType"] {
  return (
    v === "exact" || v === "equivalent" || v === "partial" || v === "missing"
  );
}

function coerceSkillMatches(raw: unknown): SkillMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        r != null && typeof r === "object" && !Array.isArray(r),
    )
    .map((r) => ({
      skill: typeof r.skill === "string" ? r.skill : "",
      resumeEvidence:
        typeof r.resumeEvidence === "string"
          ? r.resumeEvidence
          : typeof r.resume_evidence === "string"
            ? r.resume_evidence
            : "",
      jobRequired: typeof r.jobRequired === "boolean" ? r.jobRequired : false,
      matchType: isValidMatchType(r.matchType) ? r.matchType : "missing",
    }));
}

function coerceExperienceMatches(raw: unknown): ExperienceMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        r != null && typeof r === "object" && !Array.isArray(r),
    )
    .map((r) => ({
      category: typeof r.category === "string" ? r.category : "",
      resumeYears:
        typeof r.resumeYears === "number"
          ? r.resumeYears
          : typeof r.resume_years === "number"
            ? r.resume_years
            : 0,
      jobRequiredYears:
        typeof r.jobRequiredYears === "number"
          ? r.jobRequiredYears
          : typeof r.job_required_years === "number"
            ? r.job_required_years
            : 0,
      matchScore:
        typeof r.matchScore === "number"
          ? Math.max(0, Math.min(1, r.matchScore))
          : typeof r.match_score === "number"
            ? Math.max(0, Math.min(1, r.match_score))
            : 0,
    }));
}

function coerceEducationMatches(raw: unknown): EducationMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        r != null && typeof r === "object" && !Array.isArray(r),
    )
    .map((r) => ({
      resumeEducation:
        typeof r.resumeEducation === "string"
          ? r.resumeEducation
          : typeof r.resume_education === "string"
            ? r.resume_education
            : "",
      jobRequiredEducation:
        typeof r.jobRequiredEducation === "string"
          ? r.jobRequiredEducation
          : typeof r.job_required_education === "string"
            ? r.job_required_education
            : "",
      matchType: isValidEducationMatchType(r.matchType)
        ? r.matchType
        : "missing",
      equivalents: Array.isArray(r.equivalents)
        ? r.equivalents.filter((e): e is string => typeof e === "string")
        : [],
    }));
}

function coerceKeywordMatches(
  raw: unknown,
): { term: string; found: boolean; context?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        r != null && typeof r === "object" && !Array.isArray(r),
    )
    .map((r) => ({
      term: typeof r.term === "string" ? r.term : "",
      found: typeof r.found === "boolean" ? r.found : false,
      context:
        typeof r.context === "string" ? r.context : undefined,
    }));
}

function coerceStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string");
}

function coerceScoringResult(raw: unknown): ScoringResult {
  const obj =
    raw != null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const breakdownRaw =
    obj.breakdown != null &&
    typeof obj.breakdown === "object" &&
    !Array.isArray(obj.breakdown)
      ? (obj.breakdown as Record<string, unknown>)
      : {};

  const clamp0to100 = (v: unknown) =>
    typeof v === "number" ? Math.max(0, Math.min(100, v)) : 0;

  const breakdown = {
    skillsScore: clamp0to100(breakdownRaw.skillsScore),
    experienceScore: clamp0to100(breakdownRaw.experienceScore),
    educationScore: clamp0to100(breakdownRaw.educationScore),
    keywordScore: clamp0to100(breakdownRaw.keywordScore),
  };

  const matchesRaw =
    obj.matches != null &&
    typeof obj.matches === "object" &&
    !Array.isArray(obj.matches)
      ? (obj.matches as Record<string, unknown>)
      : {};

  const gapsRaw =
    obj.gaps != null &&
    typeof obj.gaps === "object" &&
    !Array.isArray(obj.gaps)
      ? (obj.gaps as Record<string, unknown>)
      : {};

  return {
    overallScore: clamp0to100(obj.overallScore),
    breakdown,
    matches: {
      skills: coerceSkillMatches(matchesRaw.skills),
      experience: coerceExperienceMatches(matchesRaw.experience),
      education: coerceEducationMatches(matchesRaw.education),
      keywords: coerceKeywordMatches(matchesRaw.keywords),
    },
    gaps: {
      missingSkills: coerceStringArray(gapsRaw.missingSkills),
      missingExperience: coerceStringArray(gapsRaw.missingExperience),
      missingEducation: coerceStringArray(gapsRaw.missingEducation),
      missingKeywords: coerceStringArray(gapsRaw.missingKeywords),
    },
    suggestions: coerceStringArray(obj.suggestions),
    semanticRationale:
      typeof obj.semanticRationale === "string"
        ? obj.semanticRationale
        : typeof obj.semantic_rationale === "string"
          ? obj.semantic_rationale
          : "",
  };
}

/**
 * Scores a resume text semantically against a job description.
 *
 * Calls the AI with a structured prompt that asks for:
 * - Skill matches (exact, synonym, related, missing)
 * - Experience matches (years comparison)
 * - Education matches (with equivalence detection)
 * - Keyword presence
 * - Actionable gap suggestions
 * - A human-readable rationale
 */
export async function scoreResumeAgainstJob(
  resumeText: string,
  job: Job,
): Promise<ScoringResult> {
  const { systemPrompt, userPrompt } = await buildGapAnalysisPrompt(resumeText, job);

  const aiResult = await callAI({
    taskType: "resume_scoring",
    systemPrompt,
    userPrompt,
    jobId: job.id,
  });

  const parsed = parseJsonResponse<ScoringResult>(aiResult.content);

  if (!parsed) {
    throw new Error("AI failed to return valid JSON for resume scoring.");
  }

  return coerceScoringResult(parsed);
}
