/**
 * Circular SVG score ring with threshold-coloured arc.
 *
 * Adapted from `job-ops/project/components.jsx` (the Claude Design bundle).
 * Color rules:
 *   value >= 85  → success (sage green)
 *   value >= 70  → accent  (sage)
 *   value >= 55  → warn    (amber)
 *   else         → danger  (red)
 */

interface ScoreRingProps {
  value: number;
  /** Pixel size of the ring. Defaults to 56. */
  size?: number;
  /** Stroke width. Defaults to 4. */
  stroke?: number;
  /** Optional center label. Defaults to the value rounded to nearest int. */
  label?: string;
}

export function ScoreRing({ value, size = 56, stroke = 4, label }: ScoreRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (Math.max(0, Math.min(100, value)) / 100);
  const color =
    value >= 85
      ? "var(--success)"
      : value >= 70
      ? "var(--accent)"
      : value >= 55
      ? "var(--warn)"
      : "var(--danger)";

  return (
    <div
      className="score-ring"
      style={{ ["--size" as never]: `${size}px` }}
    >
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="score-text">{label ?? Math.round(value)}</span>
    </div>
  );
}
