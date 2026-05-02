import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  badge?: ReactNode;
  variant?: "hero" | "admin" | "data" | "workflow" | "quiet";
  /** @deprecated Use variant. Kept temporarily so older pages compile while styling stays semantic. */
  gradient?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  children,
  badge,
  variant = "hero",
  className,
}: PageHeaderProps) {
  const variantClass = {
    hero: "border-primary/20",
    admin: "border-border/50",
    data: "border-border/50",
    workflow: "border-primary/20",
    quiet: "border-border/50",
  }[variant];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 md:p-6 bg-card/70 backdrop-blur-md shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06),0_10px_20px_-2px_rgba(0,0,0,0.03)]",
        variantClass,
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
            )}
          </div>
          {children && (
            <div className="flex items-center gap-2">{children}</div>
          )}
        </div>
        {badge && <div className="mt-4">{badge}</div>}
      </div>
    </div>
  );
}