import type { CSSProperties, ReactNode } from "react";

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  index?: number;
  padding?: "default" | "none" | "sm";
  style?: CSSProperties;
}

export function ContentCard({
  children,
  index: _i,
  padding: _p,
  ...props
}: ContentCardProps) {
  return <div {...props}>{children}</div>;
}
