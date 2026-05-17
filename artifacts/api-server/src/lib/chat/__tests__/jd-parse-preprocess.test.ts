import { describe, it, expect } from "vitest";
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
