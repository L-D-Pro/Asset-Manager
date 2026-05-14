import type { Claim } from "@workspace/db";

export type FactKind = "company" | "date" | "metric";

export interface FactFinding {
  kind: FactKind;
  value: string;
  line: string;
  lineIndex: number;
}

export interface FactReviewResult {
  findings: FactFinding[];
  sourceCharCount: number;
}

const COMPANY_PATTERN =
  /\bat\s+([A-Z][A-Za-z0-9&\-]+(?:\s+[A-Z][A-Za-z0-9&\-]+){0,4})/g;
const METRIC_PATTERN =
  /\b\d{1,5}(?:\.\d+)?\s?(?:%|x|k|m|million|billion|\+)(?=\s|$|[.,;:!?)])/gi;
const DATE_PATTERN =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{4}\b|\b(?:19|20)\d{2}\b/gi;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildHaystack(baseResumeText: string, claims: Claim[]): string {
  const claimText = claims
    .flatMap((c) => [c.summary, ...(c.phrasingVariants ?? []), c.evidence ?? ""])
    .join(" ");
  return normalize(`${baseResumeText} ${claimText}`);
}

export function reviewFacts(args: {
  tailoredText: string;
  baseResumeText: string;
  claims: Claim[];
}): FactReviewResult {
  const haystack = buildHaystack(args.baseResumeText, args.claims);
  const findings: FactFinding[] = [];
  const lines = args.tailoredText.split(/\r?\n/);

  const matcherDefs: Array<{
    kind: FactKind;
    pattern: RegExp;
    extract: (m: RegExpExecArray) => string;
  }> = [
    { kind: "company", pattern: COMPANY_PATTERN, extract: (m) => m[1]!.trim() },
    { kind: "metric", pattern: METRIC_PATTERN, extract: (m) => m[0]! },
    { kind: "date", pattern: DATE_PATTERN, extract: (m) => m[0]! },
  ];

  lines.forEach((line, lineIndex) => {
    for (const { kind, pattern, extract } of matcherDefs) {
      const localPattern = new RegExp(pattern.source, pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = localPattern.exec(line)) !== null) {
        const value = extract(m);
        if (!haystack.includes(normalize(value))) {
          findings.push({ kind, value, line: line.trim(), lineIndex });
        }
      }
    }
  });

  return {
    findings,
    sourceCharCount:
      args.baseResumeText.length +
      args.claims.reduce((n, c) => n + (c.summary?.length ?? 0), 0),
  };
}
