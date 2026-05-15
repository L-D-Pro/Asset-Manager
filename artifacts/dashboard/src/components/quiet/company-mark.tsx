/**
 * Company avatar — a small rounded pill containing the first letter of the
 * company name with a per-letter hue rotation so they're distinguishable.
 *
 * Adapted from the design bundle.
 */

interface CompanyMarkProps {
  /** Company name or single letter. The first letter is rendered. */
  name: string;
  /** Optional explicit hue (0–360); otherwise derived from the first letter. */
  hue?: number;
  /** Pixel size; defaults to 32. */
  size?: number;
}

const HUE_BY_LETTER: Record<string, number> = {
  A: 0,
  B: 30,
  C: 60,
  D: 90,
  E: 120,
  F: 150,
  G: 180,
  H: 320,
  I: 220,
  J: 240,
  K: 270,
  L: 240,
  M: 0,
  N: 60,
  O: 300,
  P: 200,
  Q: 130,
  R: 25,
  S: 30,
  T: 200,
  U: 290,
  V: 350,
  W: 110,
  X: 270,
  Y: 50,
  Z: 320,
};

export function CompanyMark({ name, hue, size = 32 }: CompanyMarkProps) {
  const initial = (name?.trim()[0] ?? "?").toUpperCase();
  const h = hue ?? HUE_BY_LETTER[initial] ?? 150;
  const bg = `oklch(0.94 0.04 ${h})`;
  const fg = `oklch(0.40 0.08 ${h})`;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: bg,
        color: fg,
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        fontSize: Math.round(size * 0.5),
        fontWeight: 500,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        border: "1px solid var(--line-soft)",
      }}
    >
      {initial}
    </div>
  );
}
