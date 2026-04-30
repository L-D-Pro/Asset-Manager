import {
  db,
  proposalVersionsTable,
  type FreelanceProfile,
  type FreelanceProject,
} from "@workspace/db";
import { callAI, parseJsonResponse } from "../ai-client";
import { logger } from "../logger";

interface ProposalAiResult {
  proposalText?: unknown;
  clientMessageText?: unknown;
  bidAmount?: unknown;
  bidType?: unknown;
  milestones?: unknown;
  citedProof?: unknown;
  riskNotes?: unknown;
}

const SYSTEM_PROMPT = `You draft Upwork-style freelance proposals as a human-approved assistant.
CRITICAL RULES:
1. Use only the provided contractor profile, portfolio, skills, proof links, and project text.
2. Do not claim availability, certifications, outcomes, earnings, or platform history unless provided.
3. Do not create spammy, generic, or manipulative messages.
4. Recommend a bid, but the human will review and submit manually.
5. If the project looks risky or weak-fit, say so in riskNotes.

Return ONLY valid JSON:
{
  "proposalText": "Tailored proposal draft",
  "clientMessageText": "Short optional client message",
  "bidAmount": "decimal number as string or null",
  "bidType": "fixed|hourly|unknown",
  "milestones": [{"name":"...", "amount":"...", "description":"..."}],
  "citedProof": [{"label":"...", "source":"profile|portfolio|proof_link|skill"}],
  "riskNotes": "Risk or fit notes"
}`;

export async function draftProposalForProject(
  project: FreelanceProject,
  profile: FreelanceProfile,
): Promise<typeof proposalVersionsTable.$inferSelect> {
  const result = await callAI({
    taskType: "proposal_drafting",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt:
      `Contractor profile:\n${JSON.stringify(profile, null, 2)}\n\n` +
      `Project:\n${JSON.stringify(project, null, 2)}\n\n` +
      "Draft a truthful, specific proposal and bid recommendation.",
  });

  const parsed = parseJsonResponse<ProposalAiResult>(result.content);
  if (
    !parsed ||
    typeof parsed.proposalText !== "string" ||
    parsed.proposalText.trim().length === 0
  ) {
    logger.warn(
      { projectId: project.id, raw: result.content.slice(0, 500) },
      "Proposal drafting returned invalid JSON",
    );
    const [row] = await db
      .insert(proposalVersionsTable)
      .values({
        projectId: project.id,
        profileId: profile.id,
        label: "AI proposal - generation failed",
        status: "pending_approval",
        proposalText: result.content,
        rawContent: result.content,
        riskNotes: "AI output could not be parsed as structured JSON. Review manually before using.",
        metadata: { modelName: result.modelName, promptVersionId: result.promptVersionId },
      })
      .returning();
    return row!;
  }

  const [row] = await db
    .insert(proposalVersionsTable)
    .values({
      projectId: project.id,
      profileId: profile.id,
      label: `AI proposal - ${new Date().toLocaleDateString()}`,
      status: "pending_approval",
      proposalText: parsed.proposalText.trim(),
      clientMessageText:
        typeof parsed.clientMessageText === "string"
          ? parsed.clientMessageText.trim()
          : null,
      bidAmount:
        typeof parsed.bidAmount === "string" || typeof parsed.bidAmount === "number"
          ? String(parsed.bidAmount)
          : null,
      bidType: typeof parsed.bidType === "string" ? parsed.bidType : "unknown",
      milestones: Array.isArray(parsed.milestones)
        ? parsed.milestones as Record<string, unknown>[]
        : [],
      citedProof: Array.isArray(parsed.citedProof)
        ? parsed.citedProof as Record<string, unknown>[]
        : [],
      riskNotes: typeof parsed.riskNotes === "string" ? parsed.riskNotes : null,
      rawContent: result.content,
      metadata: { modelName: result.modelName, promptVersionId: result.promptVersionId },
    })
    .returning();

  return row!;
}
