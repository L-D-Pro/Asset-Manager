interface CompanyMarkProps {
  name: string;
}

const COMPANY_HUES: Record<string, number> = {
  L: 285, N: 50, H: 320, S: 30, P: 200, M: 0, A: 160, V: 245,
};

export function CompanyMark({ name }: CompanyMarkProps) {
  const initial = (name?.trim()[0] ?? "?").toUpperCase();
  const h = COMPANY_HUES[initial] ?? 150;
  const bg1 = `oklch(0.55 0.18 ${h})`;
  const bg2 = `oklch(0.42 0.16 ${h})`;
  return (
    <div
      className="company-mark"
      style={{
        background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`,
      }}
    >
      {initial}
    </div>
  );
}
