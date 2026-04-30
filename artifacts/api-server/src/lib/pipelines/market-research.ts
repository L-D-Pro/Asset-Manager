import { callAI, parseJsonResponse } from "../ai-client.js";
import type { MarketAnalysis } from "@workspace/db";

const SYSTEM_PROMPT = `You are a senior labor market analyst and career strategist with expertise in talent trends, compensation benchmarks, and skill demand forecasting.

Your task is to analyze the job market for a specific role and provide actionable, data-driven insights.

Provide your output strictly as a JSON object with the following exact shape:
{
  "marketOverview": {
    "demandLevel": "high|medium|low",
    "competition": "high|medium|low",
    "salaryAlignment": "above|at|below-market",
    "summary": "A 2-3 sentence market overview."
  },
  "requiredSkills": [
    { "skill": "Skill name", "frequency": "required|common|nice-to-have", "category": "technical|soft|domain" }
  ],
  "certifications": [
    { "name": "Cert name", "demand": "high|medium|low", "estimatedValue": "Brief value prop", "provider": "Issuing org" }
  ],
  "trends": {
    "emerging": ["Trend 1", "Trend 2"],
    "declining": ["Declining skill 1"],
    "industryShifts": ["Shift 1", "Shift 2"]
  },
  "actionPlan": {
    "immediate": ["Action 1", "Action 2"],
    "shortTerm": ["Action 3"],
    "longTerm": ["Action 4"]
  },
  "salaryInsights": {
    "rangeLow": 80000,
    "rangeHigh": 140000,
    "median": 110000,
    "factors": ["Factor 1", "Factor 2"]
  }
}

Guidelines:
- Demand level reflects current hiring velocity for this role.
- Competition reflects candidate supply vs demand.
- Salary alignment compares the user's target to market median.
- Include 8-12 skills total across all frequencies.
- Include 3-6 certifications.
- Salary ranges should be realistic USD annual figures.
- Do not include markdown outside the JSON block.`;

export interface MarketResearchInput {
  jobTitle: string;
  location?: string;
  experienceLevel?: string;
  salaryTarget?: number;
}

export async function runMarketResearchPipeline(
  input: MarketResearchInput
): Promise<MarketAnalysis> {
  const { jobTitle, location, experienceLevel, salaryTarget } = input;

  const userPrompt = `
Analyze the job market for the following role:

JOB TITLE: ${jobTitle}
${location ? `LOCATION: ${location}` : ""}
${experienceLevel ? `EXPERIENCE LEVEL: ${experienceLevel}` : ""}
${salaryTarget ? `TARGET SALARY: $${salaryTarget.toLocaleString()}` : ""}

Provide the complete market analysis in JSON format.
  `.trim();

  const aiResult = await callAI({
    taskType: "market_research",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  const parsed = parseJsonResponse<MarketAnalysis>(aiResult.content);

  if (!parsed) {
    throw new Error("AI failed to return valid JSON for market research.");
  }

  return parsed;
}
