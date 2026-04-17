import type { Request, Response } from "express";
import mammoth from "mammoth";
import multer from "multer";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_AI_SOURCE_CHARS = 30_000;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

type PdfGlobalPolyfills = typeof globalThis & {
  DOMMatrix?: new (init?: string | number[] | ArrayBuffer | ArrayBufferView) => unknown;
  ImageData?: new (data?: unknown, width?: number, height?: number) => unknown;
  Path2D?: new (path?: string | unknown) => unknown;
};

export class UploadValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

export async function parseSingleDocumentUpload(
  req: Request,
  res: Response,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          reject(new UploadValidationError("File must be 10 MB or smaller."));
          return;
        }
        reject(new UploadValidationError(err.message));
        return;
      }

      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

export function getUploadedDocument(req: Request): Express.Multer.File | null {
  return req.file ?? null;
}

export async function extractTextFromDocumentFile(
  file: Express.Multer.File,
): Promise<string> {
  validateDocumentFile(file);

  const extension = path.extname(file.originalname).toLowerCase();

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return normalizeExtractedText(result.value);
  }

  try {
    ensurePdfParsePolyfills();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return normalizeExtractedText(result.text);
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    if (extension === ".pdf") {
      throw new UploadValidationError(
        "PDF text extraction is unavailable in this environment. Paste the text instead or upload a DOCX file.",
      );
    }

    throw error;
  }
}

export function truncateForAi(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= MAX_AI_SOURCE_CHARS) {
    return { text, truncated: false };
  }

  return {
    text: text.slice(0, MAX_AI_SOURCE_CHARS),
    truncated: true,
  };
}

function validateDocumentFile(file: Express.Multer.File): void {
  const extension = path.extname(file.originalname).toLowerCase();
  const validDocx = extension === ".docx" && file.mimetype === DOCX_MIME;
  const validPdf = extension === ".pdf" && file.mimetype === PDF_MIME;

  if (!validDocx && !validPdf) {
    throw new UploadValidationError("Upload a DOCX or text-based PDF file.");
  }
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensurePdfParsePolyfills(): void {
  const globalScope = globalThis as PdfGlobalPolyfills;

  if (typeof globalScope.DOMMatrix === "undefined") {
    globalScope.DOMMatrix = class DOMMatrix {
      constructor(_init?: string | number[] | ArrayBuffer | ArrayBufferView) {}
    };
  }

  if (typeof globalScope.ImageData === "undefined") {
    globalScope.ImageData = class ImageData {
      width = 0;
      height = 0;
      data = new Uint8ClampedArray();

      constructor(_data?: unknown, width = 0, height = 0) {
        this.width = width;
        this.height = height;
      }
    };
  }

  if (typeof globalScope.Path2D === "undefined") {
    globalScope.Path2D = class Path2D {
      constructor(_path?: string | unknown) {}
    };
  }
}
