import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  badge?: ReactNode;
  variant?: "hero" | "admin" | "data" | "workflow" | "quiet";
  gradient?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  children,
  badge,
  variant: _v,
  gradient: _g,
  ...props
}: PageHeaderProps) {
  return (
    <div {...props}>
      <div>
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children && <div>{children}</div>}
      </div>
      {badge && <div>{badge}</div>}
    </div>
  );
}
