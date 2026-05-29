import { describe, expect, it } from "vitest";
import { inspectContextRequirements } from "../context-requirements";
import type { MessageAttachment } from "@workspace/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBaseResumeAttachment(): MessageAttachment {
  return { kind: "base_resume", snapshot: { content: "My resume" } };
}

function makeJobAttachment(): MessageAttachment {
  return { kind: "job", refId: 1, snapshot: { title: "Software Engineer" } };
}

function makeClaimsAttachment(): MessageAttachment {
  return { kind: "claims", snapshot: { claims: [] } };
}

function makeJdDocumentAttachment(): MessageAttachment {
  return {
    kind: "document",
    snapshot: {
      contentText:
        "About the role: We are looking for a talented engineer. Requirements: 3+ years of experience. " +
        "Responsibilities include designing and building systems. Qualifications include a degree in CS.",
    },
  };
}

function makeNonJdDocumentAttachment(): MessageAttachment {
  return {
    kind: "document",
    snapshot: { contentText: "This is a random document without any JD signals." },
  };
}

/** A long (>300 chars), JD-like user message. */
const longJdMessage =
  "We are seeking a motivated Software Engineer to join our team. " +
  "Responsibilities include building scalable systems, reviewing pull requests, and mentoring junior engineers. " +
  "Requirements: 5+ years of experience with TypeScript and Node.js. " +
  "Qualifications: a degree in Computer Science or equivalent. Benefits include health, dental, and vision. " +
  "Salary range: $120,000 - $160,000. Location: Remote (US).";

// Sanity-check that the long message is actually >300 chars.
if (longJdMessage.length <= 300) {
  throw new Error("Test setup error: longJdMessage must be >300 chars");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("inspectContextRequirements — no tailor slug", () => {
  it("returns non-blocking with no warnings when no tailor slug selected (no attachments)", () => {
    const result = inspectContextRequirements({
      selectedSlugs: [],
      attachments: [],
      userMessage: "Hello, help me with my cover letter.",
    });

    expect(result.blocking).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns non-blocking when slug is 'cover_letter' and no attachments", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["cover_letter"],
      attachments: [],
      userMessage: "Write me a cover letter.",
    });

    expect(result.blocking).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("inspectContextRequirements — tailor slug with both required contexts", () => {
  it("case 1: base_resume + job attachment with tailor slug → not blocking", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [makeBaseResumeAttachment(), makeJobAttachment()],
      userMessage: "Tailor my resume for this job.",
    });

    expect(result.hasBaseResume).toBe(true);
    expect(result.hasJobContext).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("inspectContextRequirements — tailor slug, missing job context", () => {
  it("case 2: base_resume only + tailor slug → blocks, warns about missing JD", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [makeBaseResumeAttachment()],
      userMessage: "Tailor my resume please.",
    });

    expect(result.hasBaseResume).toBe(true);
    expect(result.hasJobContext).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/[Jj]ob description/);
  });
});

describe("inspectContextRequirements — tailor slug, missing base resume", () => {
  it("case 3: job only + tailor slug → blocks, warns about missing base resume", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [makeJobAttachment()],
      userMessage: "Tailor my resume for this job.",
    });

    expect(result.hasBaseResume).toBe(false);
    expect(result.hasJobContext).toBe(true);
    expect(result.blocking).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/[Bb]ase resume/);
  });
});

describe("inspectContextRequirements — tailor slug, long pasted JD in message", () => {
  it("case 4: long JD in message + no attachments + tailor slug → blocks (no base resume)", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["tailor_resume"],
      attachments: [],
      userMessage: longJdMessage,
    });

    // Job context detected from message text
    expect(result.hasJobContext).toBe(true);
    // But no base resume
    expect(result.hasBaseResume).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.warnings.some((w) => /[Bb]ase resume/.test(w))).toBe(true);
  });
});

describe("inspectContextRequirements — non-tailoring chat (case 5)", () => {
  it("case 5: non-resume-tailoring chat — no blocking regardless of missing attachments", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["general_chat"],
      attachments: [],
      userMessage: "What are some tips for negotiating salary?",
    });

    expect(result.blocking).toBe(false);
    expect(result.warnings).toHaveLength(0);
    expect(result.hasBaseResume).toBe(true);
    expect(result.hasJobContext).toBe(true);
  });
});

describe("inspectContextRequirements — JD-like document attachment", () => {
  it("case 6: JD-like document attachment counts as job context", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [makeBaseResumeAttachment(), makeJdDocumentAttachment()],
      userMessage: "Please tailor my resume.",
    });

    expect(result.hasJobContext).toBe(true);
    expect(result.hasBaseResume).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("non-JD document attachment does NOT count as job context", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [makeBaseResumeAttachment(), makeNonJdDocumentAttachment()],
      userMessage: "Tailor my resume.",
    });

    expect(result.hasJobContext).toBe(false);
    expect(result.blocking).toBe(true);
  });
});

describe("inspectContextRequirements — claims detection", () => {
  it("hasClaims is true when claims attachment is present (tailor slug)", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [makeBaseResumeAttachment(), makeJobAttachment(), makeClaimsAttachment()],
      userMessage: "Tailor my resume.",
    });

    expect(result.hasClaims).toBe(true);
  });

  it("hasClaims is false when no claims attachment (tailor slug)", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [makeBaseResumeAttachment(), makeJobAttachment()],
      userMessage: "Tailor my resume.",
    });

    expect(result.hasClaims).toBe(false);
  });

  it("hasClaims is false when no tailor slug (non-blocking path)", () => {
    const result = inspectContextRequirements({
      selectedSlugs: [],
      attachments: [],
      userMessage: "Hello.",
    });

    expect(result.hasClaims).toBe(false);
  });
});

describe("inspectContextRequirements — tailor slug variations", () => {
  const allVariants = [
    "resume_tailoring",
    "resume-tailoring",
    "resumetailoring",
    "tailor_resume",
    "tailor-resume",
    "tailorresume",
    "RESUME_TAILORING",
    "Tailor_Resume",
  ];

  for (const slug of allVariants) {
    it(`detects tailoring slug: "${slug}"`, () => {
      const result = inspectContextRequirements({
        selectedSlugs: [slug],
        attachments: [],
        userMessage: "Tailor my resume.",
      });

      // With no attachments and a tailor slug, it should block (no base resume, no JD).
      expect(result.blocking).toBe(true);
    });
  }
});

describe("inspectContextRequirements — both missing", () => {
  it("blocks and includes both warnings when both base_resume and job are missing", () => {
    const result = inspectContextRequirements({
      selectedSlugs: ["resume_tailoring"],
      attachments: [],
      userMessage: "Please tailor my resume.",
    });

    expect(result.hasBaseResume).toBe(false);
    expect(result.hasJobContext).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.some((w) => /[Bb]ase resume/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /[Jj]ob description/.test(w))).toBe(true);
  });
});
