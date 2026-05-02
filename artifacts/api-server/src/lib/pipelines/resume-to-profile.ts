import {
  db,
  baseResumeVersionsTable,
  roleProfilesTable,
} from "@workspace/db";
import { desc } from "drizzle-orm";
import { callAI, parseJsonResponse } from "../ai-client";
import { logger } from "../logger";

export class MissingBaseResumeError extends Error {
  constructor() {
    super("Base resume is required before extracting a profile. Save your current resume first.");
    this.name = "MissingBaseResumeError";
  }
}

interface AiGeneratedProfile {
  name?: unknown;
  targetRoles?: unknown;
  skills?: unknown;
  experienceYearsMin?: unknown;
  experienceYearsMax?: unknown;
  education?: unknown;
  salaryMin?: unknown;
  salaryMax?: unknown;
  location?: unknown;
  remotePreference?: unknown;
  industry?: unknown;
  keywords?: unknown;
  summary?: unknown;
}

const SYSTEM_PROMPT = `You are an expert career strategist and recruiter. Your task is to analyze a resume and extract a structured role profile that captures the candidate's target role preferences, skills, experience, and career goals.

Analyze the resume carefully and return ONLY valid JSON with this exact structure:
{
  "name": "string - human readable profile name, e.g. 'Senior Full Stack Engineer'",
  "targetRoles": ["string array of target job titles"],
  "skills": ["string array of key technical and soft skills"],
  "experienceYearsMin": number,
  "experienceYearsMax": number,
  "education": "string - highest education level",
  "salaryMin": number or 0,
  "salaryMax": number or 0,
  "location": "string - preferred location",
  "remotePreference": "remote | hybrid | onsite | any",
  "industry": "string - preferred industry",
  "keywords": ["string array of additional relevant keywords"],
  "summary": "string - 2-3 sentence summary of the candidate's profile"
}`;

/**
 * Runs the resume-to-profile pipeline:
 * 1. Fetches the latest base resume version.
 * 2. Calls the AI to extract a structured profile from the resume.
 * 3. Maps the AI-generated fields to the roleProfilesTable schema.
 * 4. Inserts the new profile with isActive: true.
 * Returns the created RoleProfile row.
 */
export async function runResumeToProfilePipeline(): Promise<typeof roleProfilesTable.$inferSelect> {
  logger.info("Starting resume-to-profile pipeline");

  const [baseResumeVersion] = await db
    .select()
    .from(baseResumeVersionsTable)
    .orderBy(desc(baseResumeVersionsTable.id))
    .limit(1);

  if (!baseResumeVersion) {
    throw new MissingBaseResumeError();
  }

  const resumeContent = baseResumeVersion.contentText;

  const result = await callAI({
    taskType: "resume_analysis",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Extract a structured role profile from the following resume:\n\n${resumeContent}`,
  });

  const parsed = parseJsonResponse<AiGeneratedProfile>(result.content);

  if (!parsed || typeof parsed.name !== "string" || parsed.name.trim() === "") {
    logger.error(
      { raw: result.content.slice(0, 500) },
      "AI returned unparseable JSON for resume-to-profile — storing failed",
    );
    throw new Error("AI returned unparseable profile data");
  }

  const allKeywords = [
    ...(Array.isArray(parsed.skills)
      ? parsed.skills.filter((s): s is string => typeof s === "string")
      : []),
    ...(Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === "string")
      : []),
  ];

  const experienceLines = [];
  if (typeof parsed.experienceYearsMin === "number" || typeof parsed.experienceYearsMax === "number") {
    experienceLines.push(
      `Experience: ${parsed.experienceYearsMin ?? "?"} - ${parsed.experienceYearsMax ?? "?"} years`,
    );
  }
  if (typeof parsed.education === "string" && parsed.education) {
    experienceLines.push(`Education: ${parsed.education}`);
  }

  const preferenceLines = [];
  if (typeof parsed.industry === "string" && parsed.industry) {
    preferenceLines.push(`Industry: ${parsed.industry}`);
  }
  if (typeof parsed.location === "string" && parsed.location) {
    preferenceLines.push(`Location: ${parsed.location}`);
  }
  if (typeof parsed.remotePreference === "string" && parsed.remotePreference && parsed.remotePreference !== "any") {
    preferenceLines.push(`Remote preference: ${parsed.remotePreference}`);
  }

  const targetRoles = Array.isArray(parsed.targetRoles)
    ? parsed.targetRoles.filter((r): r is string => typeof r === "string")
    : [];

  const description = [
    typeof parsed.summary === "string" ? parsed.summary : null,
    targetRoles.length > 0 ? `Target roles: ${targetRoles.join(", ")}` : null,
    ...experienceLines,
    ...preferenceLines,
  ].filter((line): line is string => line !== null && line !== "").join("\n");

  const hardFilters: Record<string, unknown> = {
    requiredKeywords: allKeywords,
    blockedKeywords: [],
  };

  if (typeof parsed.salaryMin === "number") {
    hardFilters.minSalary = parsed.salaryMin;
  }

  const softWeights: Record<string, number> = {};
  for (const keyword of allKeywords) {
    softWeights[keyword] = 5;
  }

  const [row] = await db
    .insert(roleProfilesTable)
    .values({
      name: parsed.name.trim(),
      description: description || null,
      hardFilters,
      softWeights,
      companyAllowList: [],
      companyDenyList: [],
      isActive: true,
    })
    .returning();

  logger.info(
    { profileId: row!.id, name: parsed.name },
    "Resume-to-profile pipeline completed",
  );

  return row!;
}
