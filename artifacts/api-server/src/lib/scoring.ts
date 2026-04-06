import type { Job, RoleProfile, Claim } from "@workspace/db";

export interface JobScoreResult {
  jobId: number;
  roleProfileId: number;
  score: number;
  passesHardFilters: boolean;
  hardFilterFailures: string[];
  matchedSkills: string[];
  unmatchedRequiredSkills: string[];
  matchedNiceToHaveSkills: string[];
}

/**
 * Normalizes a string for keyword matching: lowercase and trim.
 */
function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Checks if any job skill/keyword contains the filter term (substring match).
 */
function jobContainsTerm(jobTerms: string[], filterTerm: string): boolean {
  const normFilter = normalize(filterTerm);
  return jobTerms.some(
    (t) => normalize(t).includes(normFilter) || normFilter.includes(normalize(t)),
  );
}

/**
 * Safely extract string array from an unknown value.
 * Returns an empty array if the value is not a string array.
 */
function safeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string");
}

/**
 * Safely extract a record of numeric weights from an unknown value.
 * Non-numeric weight values are skipped.
 */
function safeWeightMap(val: unknown): Record<string, number> {
  if (val == null || typeof val !== "object" || Array.isArray(val)) return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Evaluates a job against a role profile's hard filters and soft weights.
 *
 * Hard filters (from roleProfile.hardFilters) are structured as:
 *   { requiredKeywords?: string[], blockedKeywords?: string[], minSalary?: number }
 *
 * Soft weights (from roleProfile.softWeights) are structured as:
 *   { [keyword: string]: number }  — keyword -> weight (0–10)
 *   Max achievable score is sum of all weights; returned score is 0–100 normalised.
 */
export function scoreJobAgainstProfile(
  job: Job,
  roleProfile: RoleProfile,
): JobScoreResult {
  const hardFiltersRaw =
    roleProfile.hardFilters != null &&
    typeof roleProfile.hardFilters === "object" &&
    !Array.isArray(roleProfile.hardFilters)
      ? (roleProfile.hardFilters as Record<string, unknown>)
      : {};

  const softWeights = safeWeightMap(roleProfile.softWeights);

  const allJobTerms = [
    ...(job.parsedRequiredSkills ?? []),
    ...(job.parsedNiceToHaveSkills ?? []),
    ...(job.parsedKeywords ?? []),
    job.title,
    job.company,
  ].filter(Boolean) as string[];

  const hardFilterFailures: string[] = [];

  const requiredKeywords = safeStringArray(hardFiltersRaw["requiredKeywords"]);
  for (const kw of requiredKeywords) {
    if (!jobContainsTerm(allJobTerms, kw)) {
      hardFilterFailures.push(`Missing required keyword: "${kw}"`);
    }
  }

  const blockedKeywords = safeStringArray(hardFiltersRaw["blockedKeywords"]);
  for (const kw of blockedKeywords) {
    if (jobContainsTerm(allJobTerms, kw)) {
      hardFilterFailures.push(`Contains blocked keyword: "${kw}"`);
    }
  }

  const minSalary = hardFiltersRaw["minSalary"];
  if (
    typeof minSalary === "number" &&
    Number.isFinite(minSalary) &&
    job.salaryMax != null &&
    job.salaryMax < minSalary
  ) {
    hardFilterFailures.push(
      `Salary max (${job.salaryMax}) below minimum (${minSalary})`,
    );
  }

  const passesHardFilters = hardFilterFailures.length === 0;

  const requiredSkills = job.parsedRequiredSkills ?? [];
  const niceToHaveSkills = job.parsedNiceToHaveSkills ?? [];

  let weightedScore = 0;
  let totalPossibleWeight = 0;
  const matchedSkills: string[] = [];
  const unmatchedRequiredSkills: string[] = [];
  const matchedNiceToHaveSkills: string[] = [];

  for (const [kw, weight] of Object.entries(softWeights)) {
    totalPossibleWeight += weight;
    if (jobContainsTerm(allJobTerms, kw)) {
      weightedScore += weight;
      matchedSkills.push(kw);
    }
  }

  for (const skill of requiredSkills) {
    const matched = Object.keys(softWeights).some(
      (kw) =>
        normalize(kw).includes(normalize(skill)) ||
        normalize(skill).includes(normalize(kw)),
    );
    if (
      !matched &&
      !matchedSkills.some((m) =>
        normalize(m).includes(normalize(skill)),
      )
    ) {
      unmatchedRequiredSkills.push(skill);
    }
  }

  for (const skill of niceToHaveSkills) {
    if (jobContainsTerm(matchedSkills, skill)) {
      matchedNiceToHaveSkills.push(skill);
    }
  }

  const normalizedScore =
    totalPossibleWeight > 0
      ? Math.round((weightedScore / totalPossibleWeight) * 100)
      : 0;

  return {
    jobId: job.id,
    roleProfileId: roleProfile.id,
    score: normalizedScore,
    passesHardFilters,
    hardFilterFailures,
    matchedSkills,
    unmatchedRequiredSkills,
    matchedNiceToHaveSkills,
  };
}

export interface ClaimMatchResult {
  claim: Claim;
  score: number;
  matchedKeywords: string[];
  matchType: "required" | "nice_to_have" | "keyword";
}

/**
 * Ranks claims by relevance to a job's required skills, nice-to-have skills, and keywords.
 * Each claim is scored by how many of its tags and phrasing variants overlap with job terms.
 */
export function matchClaimsToJob(job: Job, claims: Claim[]): ClaimMatchResult[] {
  const requiredSkills = (job.parsedRequiredSkills ?? []).map(normalize);
  const niceToHaveSkills = (job.parsedNiceToHaveSkills ?? []).map(normalize);
  const keywords = (job.parsedKeywords ?? []).map(normalize);

  const results: ClaimMatchResult[] = [];

  for (const claim of claims) {
    const claimTerms = [
      claim.summary,
      ...(claim.phrasingVariants ?? []),
      ...(claim.applicableTags ?? []),
      claim.domain ?? "",
    ]
      .filter(Boolean)
      .map(normalize);

    const matchedKeywords: string[] = [];
    let score = 0;
    let matchType: "required" | "nice_to_have" | "keyword" = "keyword";

    for (const term of claimTerms) {
      for (const req of requiredSkills) {
        if (term.includes(req) || req.includes(term)) {
          if (!matchedKeywords.includes(req)) {
            matchedKeywords.push(req);
            score += 3;
            matchType = "required";
          }
        }
      }
      for (const nth of niceToHaveSkills) {
        if (term.includes(nth) || nth.includes(term)) {
          if (!matchedKeywords.includes(nth)) {
            matchedKeywords.push(nth);
            score += 2;
            if (matchType === "keyword") matchType = "nice_to_have";
          }
        }
      }
      for (const kw of keywords) {
        if (term.includes(kw) || kw.includes(term)) {
          if (!matchedKeywords.includes(kw)) {
            matchedKeywords.push(kw);
            score += 1;
          }
        }
      }
    }

    if (score > 0) {
      results.push({ claim, score, matchedKeywords, matchType });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
