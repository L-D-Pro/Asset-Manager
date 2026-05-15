import type { ReactNode } from "react";

interface PageShellProps {
  heading: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

function PageShell({
  heading,
  eyebrow,
  subtitle,
  actions,
  children,
}: PageShellProps) {
  return (
    <div>
      {eyebrow && <div>{eyebrow}</div>}
      <h1>{heading}</h1>
      {subtitle && <p>{subtitle}</p>}
      {actions && <div>{actions}</div>}
      {children}
    </div>
  );
}
export { PageShell };
