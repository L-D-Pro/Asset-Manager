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
 hero: "border-primary/25 bg-card",
 admin: "border-border bg-card",
 data: "border-border bg-card",
 workflow: "border-primary/25 bg-card",
 quiet: "border-border bg-transparent",
 }[variant];

 return (
 <div
 className={cn(
 "relative overflow-hidden rounded-2xl border p-5 md:p-6",
 variantClass,
 className
 )}
 >
 <div className="absolute inset-x-0 top-0 h-px bg-border" />
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
