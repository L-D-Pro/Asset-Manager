interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  index?: number;
}

export function AnimatedCard({ children }: AnimatedCardProps) {
  return <div>{children}</div>;
}
