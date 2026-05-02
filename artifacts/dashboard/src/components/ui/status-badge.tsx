import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  new: { variant: "secondary", className: "bg-muted text-muted-foreground border-border" },
  parsing: { variant: "outline", className: "bg-warning/10 text-warning border-warning/25" },
  tailoring: { variant: "outline", className: "bg-primary/10 text-primary border-primary/25" },
  drafting: { variant: "outline", className: "bg-primary/10 text-primary border-primary/25" },
  ready: { variant: "outline", className: "bg-success/10 text-success border-success/25" },
  parsed: { variant: "outline", className: "bg-success/10 text-success border-success/25" },
  generated: { variant: "outline", className: "bg-primary/10 text-primary border-primary/25" },
  reviewed: { variant: "outline", className: "bg-primary/10 text-primary border-primary/25" },
  approved: { variant: "outline", className: "bg-primary/10 text-primary border-primary/25" },
  scored: { variant: "outline", className: "bg-success/10 text-success border-success/25" },
  applied: { variant: "default", className: "bg-success text-white" },
  rejected: { variant: "destructive" },
  archived: { variant: "destructive" },
  pending: { variant: "outline", className: "bg-warning/10 text-warning border-warning/25" },
  active: { variant: "outline", className: "bg-success/10 text-success border-success/25" },
  interview: { variant: "outline", className: "bg-primary/10 text-primary border-primary/25" },
  offer: { variant: "outline", className: "bg-accent/10 text-accent border-accent/25" },
  in_progress: { variant: "outline", className: "bg-primary/10 text-primary border-primary/25" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    variant: "outline" as const,
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant={config.variant} className={cn(config.className, "gamify-radius-pill")}>
      {status}
    </Badge>
  );
}
