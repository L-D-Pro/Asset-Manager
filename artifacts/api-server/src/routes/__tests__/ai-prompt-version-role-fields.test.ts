import { describe, expect, it } from "vitest";
import {
  UpdateAiPromptVersionBody,
  CreateAiPromptVersionBody,
  UpdateAiPromptVersionResponse,
  ListAiPromptVersionsResponseItem,
} from "@workspace/api-zod";

describe("ai_prompt_versions OpenAPI spec — role fields", () => {
  it("UpdateAiPromptVersionBody accepts roleLabel, personality, goals, skillTags", () => {
    const result = UpdateAiPromptVersionBody.safeParse({
      roleLabel: "Resume Expert",
      personality: "You are an expert ATS resume editor.",
      goals: "Reorder, rephrase, prune. Never invent.",
      skillTags: ["ats", "tailoring", "claim-attribution"],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      roleLabel: "Resume Expert",
      personality: "You are an expert ATS resume editor.",
      goals: "Reorder, rephrase, prune. Never invent.",
      skillTags: ["ats", "tailoring", "claim-attribution"],
    });
  });

  it("CreateAiPromptVersionBody accepts the same role fields", () => {
    const result = CreateAiPromptVersionBody.safeParse({
      taskScope: "resume_tailoring",
      label: "test",
      systemPrompt: "test prompt",
      roleLabel: "Resume Expert",
      personality: "Meticulous",
      goals: "Tailor truthfully",
      skillTags: ["ats"],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      roleLabel: "Resume Expert",
      personality: "Meticulous",
      goals: "Tailor truthfully",
      skillTags: ["ats"],
    });
  });

  it("Prompt version response schemas expose role fields", () => {
    const payload = {
      id: 1,
      taskScope: "resume_tailoring",
      version: 1,
      label: "test",
      systemPrompt: "test",
      userPromptTemplate: null,
      notes: null,
      isActive: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roleLabel: "Resume Expert",
      personality: "Meticulous",
      goals: "Tailor truthfully",
      skillTags: ["ats", "tailoring"],
    };
    const updateRes = UpdateAiPromptVersionResponse.safeParse(payload);
    expect(updateRes.success).toBe(true);
    if (updateRes.success) {
      expect(updateRes.data).toMatchObject({
        roleLabel: "Resume Expert",
        skillTags: ["ats", "tailoring"],
      });
    }
    const listRes = ListAiPromptVersionsResponseItem.safeParse(payload);
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data).toMatchObject({
        roleLabel: "Resume Expert",
        personality: "Meticulous",
        goals: "Tailor truthfully",
      });
    }
  });
});
