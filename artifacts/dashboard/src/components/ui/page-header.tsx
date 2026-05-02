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
    hero: "border-primary/25 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--card))_55%,hsl(var(--primary)/0.10))] shadow-[0_20px_48px_rgba(20,24,33,0.10)]",
    admin: "border-border bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--card))_72%,hsl(var(--accent)/0.10))] shadow-[0_14px_34px_rgba(20,24,33,0.08)]",
    data: "border-border bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--card))_70%,hsl(var(--primary)/0.09))] shadow-[0_14px_34px_rgba(20,24,33,0.08)]",
    workflow: "border-primary/25 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--card))_62%,hsl(var(--primary)/0.12))] shadow-[0_14px_34px_rgba(20,24,33,0.08)]",
    quiet: "border-border bg-transparent shadow-none",
  }[variant];

  return (
    <div
      className={cn(
        "relative overflow-hidden gamify-radius-chunky border p-5 md:p-6 backdrop-blur-xl gamify-shadow",
        variantClass,
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-normal">
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
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
