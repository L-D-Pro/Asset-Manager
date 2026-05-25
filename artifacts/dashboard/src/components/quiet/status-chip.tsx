export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "closed"
  | "to_do"
  | "rejected"
  | "withdrawn"
  | "new"
  | "parsed"
  | "parsing"
  | "scored"
  | "ready"
  | "tailoring"
  | "drafting"
  | "interview"
  | "archived";

const STATUS_CHIP: Record<string, string> = {
  saved: "ghost dot",
  to_do: "ghost dot",
  new: "ghost dot",
  parsing: "ghost dot",
  parsed: "ghost dot",
  scored: "ghost dot",
  ready: "ghost dot",
  tailoring: "ghost dot",
  drafting: "ghost dot",
  applied: "info dot",
  interviewing: "accent dot",
  interview: "accent dot",
  offer: "success dot",
  closed: "danger dot",
  rejected: "danger dot",
  withdrawn: "warn dot",
  archived: "danger dot",
};

const STATUS_LABEL: Record<string, string> = {
  saved: "SAVED",
  to_do: "TO DO",
  new: "NEW",
  parsing: "PARSING",
  parsed: "PARSED",
  scored: "SCORED",
  ready: "READY",
  tailoring: "TAILORING",
  drafting: "DRAFTING",
  applied: "APPLIED",
  interviewing: "INTERVIEW",
  interview: "INTERVIEW",
  offer: "OFFER",
  closed: "CLOSED",
  rejected: "REJECTED",
  withdrawn: "WITHDRAWN",
  archived: "ARCHIVED",
};

interface StatusChipProps {
  status: ApplicationStatus | string;
  label?: string;
}

export function StatusChip({ status, label }: StatusChipProps) {
  const cls = STATUS_CHIP[status] ?? "ghost dot";
  const text = label ?? STATUS_LABEL[status] ?? status.toUpperCase();
  return <span className={`chip ${cls}`}>{text}</span>;
}
