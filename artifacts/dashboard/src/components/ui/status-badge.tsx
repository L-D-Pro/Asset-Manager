import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  new: { variant: "secondary", className: "bg-slate-100 text-slate-700 border-slate-200" },
  parsing: { variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200" },
  tailoring: { variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
  drafting: { variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ready: { variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  parsed: { variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  generated: { variant: "outline", className: "bg-teal-50 text-teal-700 border-teal-200" },
  reviewed: { variant: "outline", className: "bg-violet-50 text-violet-700 border-violet-200" },
  approved: { variant: "outline", className: "bg-teal-50 text-teal-700 border-teal-200" },
  scored: { variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  applied: { variant: "default", className: "bg-emerald-500 text-white" },
  rejected: { variant: "destructive" },
  archived: { variant: "destructive" },
  pending: { variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200" },
  active: { variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  interview: { variant: "outline", className: "bg-violet-50 text-violet-700 border-violet-200" },
  offer: { variant: "outline", className: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  in_progress: { variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    variant: "outline" as const,
    className: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <Badge variant={config.variant} className={config.className}>
      {status}
    </Badge>
  );
}
