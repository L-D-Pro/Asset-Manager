import { describe, it, expect } from "vitest";

import { buildSystemPrompt } from "../system-prompt";
import type { LoadedSkill } from "../skill-loader";

const fakeSkills: LoadedSkill[] = [
  {
    slug: "resume-ats-optimizer",
    name: "ATS",
    description: "",
    body: "ATS-BODY-MARKER",
  },
  {
    slug: "cover-letter-generator",
    name: "Cover Letter",
    description: "",
    body: "COVER-LETTER-BODY-MARKER",
  },
];

describe("buildSystemPrompt", () => {
  it("produces identity + both skill bodies in order, no attachments block when empty", () => {
    const out = buildSystemPrompt({ skills: fakeSkills });
    expect(out).toContain("job-application copilot");
    const atsIdx = out.indexOf("ATS-BODY-MARKER");
    const coverIdx = out.indexOf("COVER-LETTER-BODY-MARKER");
    expect(atsIdx).toBeGreaterThan(0);
    expect(coverIdx).toBeGreaterThan(atsIdx);
    expect(out).not.toMatch(/Attached context/);
  });

  it("appends the attachments block when attachments are present", () => {
    const out = buildSystemPrompt({
      skills: fakeSkills,
      attachments: [
        { kind: "base_resume", snapshot: { contentText: "RESUME-BODY-MARKER" } },
      ],
    });
    expect(out).toContain("Attached context");
    expect(out).toContain("RESUME-BODY-MARKER");
    // Attachments block must come after both skill bodies.
    expect(out.indexOf("Attached context")).toBeGreaterThan(out.indexOf("COVER-LETTER-BODY-MARKER"));
  });
});
