import { callAI, parseJsonResponse } from "../ai-client.js";
import { searchWeb } from "../tavily-client.js";

export interface JobResearchResult {
  companyOverview: string;
  recentNewsOrProjects: string;
  cultureAndValues: string;
  interviewStrategy: string;
  roleSpecificAdvice: string;
}

const SYSTEM_PROMPT = `You are an expert technical recruiter and career strategist.
Your task is to analyze real-world research about a company and a specific job posting, and provide actionable, data-driven advice for a candidate.
You will be given the original Job Description and the latest web search results about the company.

Provide your output strictly as a JSON object with the following shape:
{
  "companyOverview": "Brief factual summary of what the company does and its market position.",
  "recentNewsOrProjects": "Any recent news, launches, or funding found in the search results.",
  "cultureAndValues": "Insights into their engineering culture or core values.",
  "interviewStrategy": "Actionable advice on how to position oneself for this specific company and role.",
  "roleSpecificAdvice": "Specific technical or domain areas the candidate should highlight based on the JD and company context."
}

Do not include any markdown formatting outside of the JSON block. Do not hallucinate data that is not in the search results or JD.`;

export async function runJobResearchPipeline(
  title: string,
  company: string,
  rawJdText: string,
  jobId: number
): Promise<JobResearchResult> {
  // Step 1: Search the web
  const query = `${company} company recent news engineering culture "${title}"`;
  const searchResults = await searchWeb(query);

  const searchContext = searchResults.results
    .map((r) => `[Source: ${r.title}]\n${r.content}`)
    .join("\n\n");

  // Step 2: Call AI to synthesize
  const userPrompt = `
COMPANY: ${company}
ROLE: ${title}

WEB SEARCH RESULTS:
${searchContext}

RAW JOB DESCRIPTION:
${rawJdText.slice(0, 15000)} // Truncated for token limits

Based on the above, provide the strategic analysis in JSON format.
  `.trim();

  const aiResult = await callAI({
    taskType: "job_research",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    jobId,
  });

  const parsed = parseJsonResponse<JobResearchResult>(aiResult.content);

  if (!parsed) {
    throw new Error("AI failed to return valid JSON for job research.");
  }

  return parsed;
}
