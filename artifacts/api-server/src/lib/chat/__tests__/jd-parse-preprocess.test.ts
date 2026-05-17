import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildParsedJdBlock, type ParsedJd } from "../context-builder";

const sampleJd: ParsedJd = {
  requiredSkills: ["TypeScript", "React"],
  niceToHaveSkills: ["GraphQL"],
  keywords: ["distributed systems", "CI/CD"],
  senioritySignal: "senior",
  location: "San Francisco, CA",
  remoteType: "hybrid",
};

describe("buildParsedJdBlock", () => {
  it("returns a markdown block with the parsed JD fields", () => {
    const block = buildParsedJdBlock(sampleJd);
    expect(block).toContain("## Job Description (pre-parsed");
    expect(block).toContain("TypeScript");
    expect(block).toContain("GraphQL");
    expect(block).toContain("senior");
    expect(block).toContain("San Francisco");
    expect(block).toContain("do not re-extract");
  });

  it("omits fields that are null or empty arrays", () => {
    const sparse: ParsedJd = {
      requiredSkills: ["Node.js"],
      niceToHaveSkills: [],
      keywords: [],
      senioritySignal: null,
      location: null,
      remoteType: null,
    };
    const block = buildParsedJdBlock(sparse);
    expect(block).toContain("Node.js");
    expect(block).not.toContain("Nice-to-have:");
    expect(block).not.toContain("Seniority:");
    expect(block).not.toContain("Location:");
  });
});

// ── parseJdText tests ─────────────────────────────────────────────────────

vi.mock("../../ai-client", () => ({
  callAI: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callAI, parseJsonResponse } from "../../ai-client";
import { parseJdText } from "../jd-parse-preprocess";

describe("parseJdText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls callAI with taskType jd_parsing and returns structured ParsedJd", async () => {
    const mockResult = { content: `{"requiredSkills":["TypeScript"],"niceToHaveSkills":[],"keywords":[],"senioritySignal":"senior","location":null,"remoteType":"remote"}` };
    vi.mocked(callAI).mockResolvedValue(mockResult as never);
    vi.mocked(parseJsonResponse).mockReturnValue({
      requiredSkills: ["TypeScript"],
      niceToHaveSkills: [],
      keywords: [],
      senioritySignal: "senior",
      location: null,
      remoteType: "remote",
    });

    const result = await parseJdText("Senior TypeScript Engineer at Acme Corp...");

    expect(callAI).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: "jd_parsing" }),
    );
    expect(result).toMatchObject({ requiredSkills: ["TypeScript"], senioritySignal: "senior" });
  });

  it("returns null when the AI response is not valid JSON", async () => {
    vi.mocked(callAI).mockResolvedValue({ content: "sorry, I cannot parse that" } as never);
    vi.mocked(parseJsonResponse).mockReturnValue(null);

    const result = await parseJdText("not a job description");
    expect(result).toBeNull();
  });
});
