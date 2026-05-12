import { describe, expect, it } from "vitest";
import { renderResumePlainText, stripMarkdownArtifacts } from "../resume-templates";

describe("resume template rendering", () => {
  it("strips markdown artifacts and renders the selected section order", () => {
    const rendered = renderResumePlainText({
      templateId: "software_developer",
      documentText: [
        "# Candidate Name",
        "candidate@example.com",
        "",
        "**Summary**",
        "Built reliable systems.",
        "",
        "**Skills**",
        "- **Languages:** TypeScript, SQL",
      ].join("\n"),
      bullets: [
        {
          text: "- **Built** a TypeScript workflow used by 40 employees.",
          section: "experience",
          claimIds: [1],
          jobKeywordsUsed: ["TypeScript"],
        },
        {
          text: "**Portfolio Studio:** shipped a React app.",
          section: "projects",
          claimIds: [2],
          jobKeywordsUsed: ["React"],
        },
      ],
    });

    expect(rendered.text).not.toContain("**");
    expect(rendered.text).not.toContain("#");
    expect(rendered.text).toContain("SUMMARY");
    expect(rendered.text).toContain("EXPERIENCE");
    expect(rendered.text).toContain("PROJECT");
    expect(rendered.text.indexOf("EXPERIENCE")).toBeLessThan(rendered.text.indexOf("PROJECT"));
    expect(rendered.validation.templateId).toBe("software_developer");
    expect(rendered.validation.markdownArtifactsRemoved).toContain("bold markers");
  });

  it("omits sections that do not belong to the selected template", () => {
    const rendered = renderResumePlainText({
      templateId: "data_engineer",
      documentText: "Candidate\ncandidate@example.com",
      bullets: [
        { text: "Completed algorithms coursework.", section: "coursework", claimIds: [1] },
        { text: "Built ETL checks for 12 pipelines.", section: "experience", claimIds: [2] },
      ],
    });

    expect(rendered.text).toContain("EXPERIENCE");
    expect(rendered.text).not.toContain("COURSEWORK");
    expect(rendered.validation.omittedSections).toContain("coursework");
  });

  it("trims lowest-scored bullets after the two-page budget", () => {
    const bullets = Array.from({ length: 35 }, (_, index) => ({
      text: `Delivered supported item ${index + 1} for ${index + 1} users.`,
      section: "experience",
      claimIds: [index + 1],
      jobKeywordsUsed: index < 5 ? ["priority"] : [],
    }));

    const rendered = renderResumePlainText({
      templateId: "student_technical_assistant",
      documentText: "Candidate\ncandidate@example.com",
      bullets,
    });

    expect(rendered.validation.renderedBulletCount).toBe(30);
    expect(rendered.validation.trimmedBulletCount).toBe(5);
  });

  it("renders dated experience entries as headers with bullets underneath", () => {
    const rendered = renderResumePlainText({
      templateId: "software_developer",
      documentText: "Candidate\ncandidate@example.com",
      bullets: [
        {
          text: "Software Developer | Acme Corp | San Diego, CA | Jan 2021 - Present",
          section: "experience",
        },
        {
          text: "Built React workflows for 40 users.",
          section: "experience",
        },
        {
          text: "Data Engineer | Beta Co | Remote | Feb 2019 - Dec 2020",
          section: "experience",
        },
        {
          text: "Maintained ETL checks for 12 pipelines.",
          section: "experience",
        },
      ],
    });

    expect(rendered.text).toContain("Software Developer | Acme Corp | San Diego, CA | Jan 2021 - Present\n- Built React workflows");
    expect(rendered.text).toContain("Data Engineer | Beta Co | Remote | Feb 2019 - Dec 2020\n- Maintained ETL checks");
  });

  it("normalizes raw markdown text without inventing content", () => {
    const stripped = stripMarkdownArtifacts("## Summary\n- **Led:** support for 10 users.");

    expect(stripped.text).toBe("Summary\nLed: support for 10 users.");
    expect(stripped.removed).toContain("markdown headings");
    expect(stripped.removed).toContain("bold markers");
  });
});
