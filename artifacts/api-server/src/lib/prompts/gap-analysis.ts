import type { Job } from "@workspace/db";
import { loadOrCreateBestPractices } from "../best-practices";

export interface GapAnalysisPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Builds a structured AI prompt that compares a resume against a job description
 * and returns a semantic scoring result.
 */
export async function buildGapAnalysisPrompt(
  resumeText: string,
  job: Job,
): Promise<GapAnalysisPrompt> {
  const domain =
    typeof job.parsedSenioritySignal === "string" &&
    job.parsedSenioritySignal.trim().length > 0
      ? job.parsedSenioritySignal.trim().toLowerCase()
      : "general";

  const bestPractices = await loadOrCreateBestPractices(domain);

  const practiceLines = bestPractices.items
    .map(
      (p, i) =>
        `${i + 1}. ${p.description}${p.rationale ? ` — ${p.rationale}` : ""}`,
    )
    .join("\n");

  const systemPrompt = `You are a resume-aware semantic scoring engine.

Your task: compare a candidate's resume against a job description and produce a structured JSON score + gap analysis.

# SCORING RULES

1. Overall score must be 0-100.
2. Breakdown scores (skills, experience, education, keyword) must each be 0-100.
3. For skills:
   - If the resume explicitly states the skill, mark matchType "exact".
   - If the resume mentions a synonym or closely related technology (e.g. "AWS" vs "Amazon Web Services"), mark "synonym".
   - If the resume mentions something adjacent but not the same (e.g. "Docker" vs "Kubernetes"), mark "related".
   - If the resume does not mention the skill at all, mark "missing".
4. For experience:
   - Compare years of experience in each category.
   - Compute matchScore as a 0-1 ratio (resumeYears / jobRequiredYears, capped at 1.0).
5. For education:
   - Detect exact matches, equivalents ("B.A." ≈ "Bachelor's Degree" ≈ "BS"), partial matches, or missing.
   - Populate equivalents array when matchType is "equivalent".
6. For keywords:
   - Check presence of each important keyword from the job.
   - Provide a short context snippet from the resume when found.
7. Gaps:
   - List only genuinely missing items (not partial or related).
8. Suggestions:
   - Provide specific, actionable suggestions (e.g. "Add experience with AWS" not "Improve skills").
   - Tailor suggestions using the best-practices below.
9. semanticRationale:
   - Write a concise human-readable paragraph summarizing why the candidate is or is not a strong fit.

# BEST PRACTICES TO GUIDE SUGGESTIONS

${practiceLines}

# OUTPUT FORMAT
Return ONLY valid JSON matching this shape exactly:

{
  "overallScore": number,
  "breakdown": {
    "skillsScore": number,
    "experienceScore": number,
    "educationScore": number,
    "keywordScore": number
  },
  "matches": {
    "skills": [
      {
        "skill": string,
        "resumeEvidence": string,
        "jobRequired": boolean,
        "matchType": "exact" | "synonym" | "related" | "missing"
      }
    ],
    "experience": [
      {
        "category": string,
        "resumeYears": number,
        "jobRequiredYears": number,
        "matchScore": number
      }
    ],
    "education": [
      {
        "resumeEducation": string,
        "jobRequiredEducation": string,
        "matchType": "exact" | "equivalent" | "partial" | "missing",
        "equivalents": string[]
      }
    ],
    "keywords": [
      {
        "term": string,
        "found": boolean,
        "context": string | null
      }
    ]
  },
  "gaps": {
    "missingSkills": string[],
    "missingExperience": string[],
    "missingEducation": string[],
    "missingKeywords": string[]
  },
  "suggestions": string[],
  "semanticRationale": string
}

Do not include markdown code fences. Return only raw JSON.`;

  const userPrompt = `=== RESUME ===
${resumeText}

=== JOB DESCRIPTION ===
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? "N/A"}
Remote: ${job.remoteType ?? "N/A"}
Salary Range: ${job.salaryMin != null && job.salaryMax != null ? `${job.salaryMin} - ${job.salaryMax} ${job.salaryCurrency ?? "USD"}` : "N/A"}

Required Skills:
${(job.parsedRequiredSkills ?? []).join("\n") || "None listed"}

Nice-to-Have Skills:
${(job.parsedNiceToHaveSkills ?? []).join("\n") || "None listed"}

Keywords:
${(job.parsedKeywords ?? []).join("\n") || "None listed"}

Responsibilities:
${(job.parsedResponsibilities ?? []).join("\n") || "None listed"}

Raw JD:
${job.rawJdText ?? "N/A"}
`.trim();

  return { systemPrompt, userPrompt };
}
