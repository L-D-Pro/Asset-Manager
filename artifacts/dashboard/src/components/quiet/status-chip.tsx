/**
 * Status badge for an application's pipeline state.
 *
 * Adapted from the design bundle. Uses `.chip.<variant>.dot` utility classes
 * defined in [index.css](../../index.css).
 */

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "closed"
  | "to_do"
  | "rejected"
  | "withdrawn";

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; variant: string }> = {
  saved: { label: "Saved", variant: "ghost" },
  to_do: { label: "To do", variant: "ghost" },
  applied: { label: "Applied", variant: "info" },
  interviewing: { label: "Interviewing", variant: "accent" },
  offer: { label: "Offer", variant: "success" },
  closed: { label: "Closed", variant: "danger" },
  rejected: { label: "Rejected", variant: "danger" },
  withdrawn: { label: "Withdrawn", variant: "warn" },
};

interface StatusChipProps {
  status: ApplicationStatus | string;
  /** Override the rendered label. */
  label?: string;
}

export function StatusChip({ status, label }: StatusChipProps) {
  const config = STATUS_CONFIG[status as ApplicationStatus] ?? { label: status, variant: "ghost" };
  return <span className={`chip ${config.variant} dot`}>{label ?? config.label}</span>;
}
