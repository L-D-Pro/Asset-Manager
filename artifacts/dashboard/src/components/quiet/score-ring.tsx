interface ScoreRingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export function ScoreRing({ value, label }: ScoreRingProps) {
  return <span>{label ?? Math.round(value)}%</span>;
}
