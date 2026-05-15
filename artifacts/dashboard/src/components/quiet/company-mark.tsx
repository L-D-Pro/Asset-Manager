interface CompanyMarkProps {
  name: string;
  hue?: number;
  size?: number;
}

export function CompanyMark({ name }: CompanyMarkProps) {
  const initial = (name?.trim()[0] ?? "?").toUpperCase();
  return <span>{initial}</span>;
}
