import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface SectionHeaderProps {
 title: string;
 description?: string;
 action?: { label: string; href: string };
 className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
 return (
 <div className={cn("flex items-center justify-between", className)}>
 <div>
 <h2 className="text-lg font-semibold text-foreground">{title}</h2>
 {description && (
 <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
 )}
 </div>
 {action && (
 <Link
 to={action.href}
 className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/85 transition-colors group"
 >
 {action.label}
 <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
 </Link>
 )}
 </div>
 );
}
