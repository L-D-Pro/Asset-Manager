interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  duration?: number;
  once?: boolean;
}

export function FadeIn({ children }: FadeInProps) {
  return <div>{children}</div>;
}
