import { callAI, parseJsonResponse } from "../ai-client.js";
import type { Job, Claim } from "@workspace/db";

export interface GapAnalysisResult {
  missingSkills: string[];
  questionsToAsk: string[];
}

const SYSTEM_PROMPT = `You are a strict, truth-oriented career coach. Your job is to identify gaps between what a job requires and what the candidate has verified experience in, and to ask targeted questions to pull out potential experience.

Input format:
JOB REQUIRED SKILLS: [list of skills]
VERIFIED CLAIMS: [list of user's existing claims]

Output format (JSON strictly):
{
  "missingSkills": ["skill1", "skill2"],
  "questionsToAsk": [
    "The job requires AWS. Have you ever deployed or maintained applications on AWS? If so, what services did you use?",
    "You have no claims related to React. Did you use React in your previous frontend roles?"
  ]
}

Only return JSON. Ask a maximum of 3 highly targeted questions covering the most critical missing skills.`;

export async function runGapAnalysisPipeline(
  job: Job,
  claims: Claim[],
  userId: number,
): Promise<GapAnalysisResult> {
  if (!job.parsedRequiredSkills || job.parsedRequiredSkills.length === 0) {
    return { missingSkills: [], questionsToAsk: [] };
  }

  const userPrompt = `
JOB REQUIRED SKILLS:
${job.parsedRequiredSkills.join(", ")}

VERIFIED CLAIMS:
${claims.map(c => `- ${c.summary}`).join("\n")}
  `.trim();

  const aiResult = await callAI({
    taskType: "gap_analysis",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    jobId: job.id,
    userId,
  });

  const parsed = parseJsonResponse<GapAnalysisResult>(aiResult.content);

  if (!parsed) {
    throw new Error("AI failed to return valid JSON for gap analysis.");
  }

  return parsed;
}

const EXTRACT_PROMPT = `You are a claim extractor. You will be given a question that was asked to a candidate, and their answer. Your job is to translate their answer into a formal, highly specific "Claim" that can be used on a resume. If the answer is vague, do your best to formalize it, but do not hallucinate metrics.

Input format:
QUESTION: [question]
ANSWER: [answer]

Output format (JSON strictly):
{
  "draftClaims": [
    {
      "domain": "experience",
      "summary": "Formalized bullet point of the claim",
      "evidenceType": "self_attestation",
      "verificationNotes": "Extracted from candidate conversation."
    }
  ]
}
`;

export async function extractClaimsFromChatPipeline(
  question: string,
  answer: string,
  jobId?: number,
  userId?: number,
): Promise<any> {
  const userPrompt = `
QUESTION:
${question}

ANSWER:
${answer}
  `.trim();

  const aiResult = await callAI({
    taskType: "claim_generation",
    systemPrompt: EXTRACT_PROMPT,
    userPrompt,
    jobId,
    userId,
  });

  const parsed = parseJsonResponse<any>(aiResult.content);

  if (!parsed) {
    throw new Error("AI failed to return valid JSON for claim extraction.");
  }

  return parsed;
}
