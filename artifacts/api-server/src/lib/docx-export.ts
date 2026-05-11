import { AlignmentType, convertInchesToTwip, Document, Packer, Paragraph, TextRun } from "docx";
import type { ResumeVersion, CoverLetterVersion } from "@workspace/db";
import { getResumeTemplate, stripMarkdownArtifacts } from "./resume-templates";

export async function generateResumeDocx(resumeVersion: ResumeVersion): Promise<Buffer> {
  const template = getResumeTemplate(resumeVersion.templateId);
  const text = stripMarkdownArtifacts(resumeVersion.tailoredDocumentText || resumeVersion.rawContent || "").text;
  const sectionLabels = new Set(template.sectionOrder);
  const paragraphs = text.split("\n").map((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return new Paragraph({
        spacing: { after: 80 },
      });
    }

    const isBullet = line.startsWith("• ");
    const bulletText = isBullet ? line.slice(2).trim() : line;
    const isHeading = sectionLabels.has(line.toLowerCase() as never) || /^[A-Z][A-Z0-9 &/.-]{2,}$/.test(line);

    if (index === 0) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: bulletText.toUpperCase(),
            bold: true,
            size: 26,
            font: "Merriweather",
          }),
        ],
      });
    }

    if (index === 1 && !isHeading && !isBullet) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [new TextRun({ text: bulletText, size: 18, font: "Merriweather Light" })],
      });
    }

    if (isHeading && !isBullet) {
      return new Paragraph({
        spacing: { before: 120, after: 60 },
        border: { bottom: { color: "444444", size: 3, style: "single" } },
        children: [
          new TextRun({
            text: line.toUpperCase(),
            bold: true,
            size: 18,
            font: "Merriweather",
          }),
        ],
      });
    }

    if (isBullet) {
      return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 40 },
        children: [new TextRun({ text: bulletText, size: 18, font: "Merriweather Light" })],
      });
    }

    return new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: bulletText, size: 18, font: "Merriweather Light" })],
    });
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.5),
            right: convertInchesToTwip(0.5),
            bottom: convertInchesToTwip(0.5),
            left: convertInchesToTwip(0.5),
          },
        },
      },
      children: paragraphs,
    }],
  });

  return await Packer.toBuffer(doc);
}

export async function generateCoverLetterDocx(coverLetterVersion: CoverLetterVersion): Promise<Buffer> {
  const text = coverLetterVersion.draftContent || "";
  
  const paragraphs = text.split("\n").map(line => {
    line = line.trim();
    if (!line) return new Paragraph({ text: "" });
    return new Paragraph({
      children: [new TextRun(line)]
    });
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  return await Packer.toBuffer(doc);
}
