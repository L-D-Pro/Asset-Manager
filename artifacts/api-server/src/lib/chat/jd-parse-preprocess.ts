import { callAI, parseJsonResponse } from "../ai-client";
import { logger } from "../logger";
import type { ParsedJd } from "./context-builder";

const JD_SYSTEM_PROMPT = `You are an expert job description parser. Extract structured information from job descriptions.
Return ONLY valid JSON with this exact structure:
{
  "requiredSkills": ["string"],
  "niceToHaveSkills": ["string"],
  "keywords": ["string"],
  "senioritySignal": "junior|mid|senior|staff|principal|director|vp|executive|null",
  "location": "city, state/country or null",
  "remoteType": "remote|hybrid|onsite|null"
}
Be precise and conservative — only include skills explicitly mentioned.`;

export async function parseJdText(text: string): Promise<ParsedJd | null> {
  try {
    const result = await callAI({
      taskType: "jd_parsing",
      systemPrompt: JD_SYSTEM_PROMPT,
      userPrompt: `Parse this job description:\n\n${text}`,
    });
    return parseJsonResponse<ParsedJd>(result.content);
  } catch (err) {
    logger.warn({ err }, "jd-parse-preprocess: callAI failed, skipping JD parse");
    return null;
  }
}
