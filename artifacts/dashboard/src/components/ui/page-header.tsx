import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  badge?: ReactNode;
  gradient?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  children,
  badge,
  gradient = "from-indigo-600 via-indigo-500 to-violet-500",
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 md:p-8 shadow-xl",
        gradient,
        className
      )}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-white/80 mt-1.5 text-sm md:text-base">{subtitle}</p>
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
