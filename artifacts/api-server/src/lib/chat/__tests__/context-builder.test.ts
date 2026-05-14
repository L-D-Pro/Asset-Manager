import { describe, it, expect } from "vitest";

import { buildAttachmentsBlock } from "../context-builder";

describe("buildAttachmentsBlock", () => {
  it("returns empty string when no attachments", () => {
    expect(buildAttachmentsBlock([])).toBe("");
  });

  it("renders a base_resume attachment", () => {
    const out = buildAttachmentsBlock([
      {
        kind: "base_resume",
        snapshot: { version: 3, contentText: "Jane Doe\nSenior Engineer", capturedAt: "2026-05-14T00:00:00Z" },
      },
    ]);
    expect(out).toContain("User's base resume");
    expect(out).toContain("version 3");
    expect(out).toContain("Jane Doe");
  });

  it("renders a job attachment with meta line", () => {
    const out = buildAttachmentsBlock([
      {
        kind: "job",
        snapshot: { title: "Senior PM", company: "ACME", location: "Remote", jdText: "Lead a team." },
      },
    ]);
    expect(out).toContain('"Senior PM"');
    expect(out).toContain("ACME");
    expect(out).toContain("Remote");
    expect(out).toContain("Lead a team");
  });

  it("flags unverified claims with the truth-lock rule", () => {
    const out = buildAttachmentsBlock([
      {
        kind: "claims",
        snapshot: {
          claims: [
            { text: "Shipped X at Y", verified: true },
            { text: "Maybe led Z", verified: false },
          ],
        },
      },
    ]);
    expect(out).toContain("[verified] Shipped X at Y");
    expect(out).toContain("[unverified — DO NOT USE IN OUTPUT] Maybe led Z");
    expect(out).toMatch(/Truth-lock rule/i);
  });

  it("omits the truth-lock rule when all claims are verified", () => {
    const out = buildAttachmentsBlock([
      {
        kind: "claims",
        snapshot: { claims: [{ text: "All good", verified: true }] },
      },
    ]);
    expect(out).not.toMatch(/Truth-lock rule/i);
  });
});
