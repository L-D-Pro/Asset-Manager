interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ProgressRing({ progress, label }: ProgressRingProps) {
  return <span>{label ?? Math.round(progress)}%</span>;
}
