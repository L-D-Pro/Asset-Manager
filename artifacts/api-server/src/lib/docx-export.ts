import { Document, Paragraph, TextRun, Packer, HeadingLevel, AlignmentType } from "docx";
import type { ResumeVersion, CoverLetterVersion } from "@workspace/db";

export async function generateResumeDocx(resumeVersion: ResumeVersion): Promise<Buffer> {
  const text = resumeVersion.tailoredDocumentText || resumeVersion.rawContent || "";
  
  // A naive but ATS-friendly generation: convert simple text into paragraphs.
  // In a real app, you might parse the structured bullets to create formal DOCX lists.
  const paragraphs = text.split("\n").map(line => {
    line = line.trim();
    if (!line) return new Paragraph({ text: "" });

    // Very simple markdown-to-docx heuristics
    if (line.startsWith("# ")) {
      return new Paragraph({
        text: line.replace("# ", ""),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      });
    } else if (line.startsWith("## ")) {
      return new Paragraph({
        text: line.replace("## ", ""),
        heading: HeadingLevel.HEADING_2,
      });
    } else if (line.startsWith("### ")) {
      return new Paragraph({
        text: line.replace("### ", ""),
        heading: HeadingLevel.HEADING_3,
      });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      return new Paragraph({
        text: line.substring(2),
        bullet: { level: 0 },
      });
    }
    
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
