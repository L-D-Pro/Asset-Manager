import { cn } from "@/lib/utils"

interface GamifiedBadgeProps {
  icon: string
  name: string
  description?: string
  variant?: "gold" | "silver" | "bronze"
  isNew?: boolean
  className?: string
}

const variantStyles = {
  gold: "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200",
  silver: "border-slate-300 bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300",
  bronze: "border-orange-300 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200",
}

function GamifiedBadge({ icon, name, description, variant = "bronze", isNew, className }: GamifiedBadgeProps) {
  return (
    <div className={cn(
      "relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 text-center transition-all hover:scale-105",
      variantStyles[variant],
      className
    )}>
      {isNew && (
        <span className="absolute -top-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground animate-pulse">
          NEW
        </span>
      )}
      <span className="text-3xl">{icon}</span>
      <span className="text-xs font-bold leading-tight">{name}</span>
      {description && (
        <span className="text-[10px] leading-tight opacity-70">{description}</span>
      )}
    </div>
  )
}

export { GamifiedBadge }
