import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center gamify-radius-chunky", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-4 border border-border">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action && (
        action.href ? (
          <Button
            asChild
            className="mt-5 rounded-md shadow-sm"
          >
            <Link to={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button
            onClick={action.onClick}
            className="mt-5 rounded-md shadow-sm"
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
