interface GamifiedBadgeProps {
  name: string;
  icon: string;
  tier: "gold" | "silver" | "bronze";
  unlocked: boolean;
  isNew?: boolean;
}

export function GamifiedBadge({ name, icon, unlocked }: GamifiedBadgeProps) {
  return <span>{unlocked ? icon : "🔒"} {name}</span>;
}
