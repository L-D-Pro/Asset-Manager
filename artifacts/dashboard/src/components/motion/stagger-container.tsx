interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  delayChildren?: number;
}

export function StaggerContainer({ children }: StaggerContainerProps) {
  return <div>{children}</div>;
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children }: StaggerItemProps) {
  return <div>{children}</div>;
}
