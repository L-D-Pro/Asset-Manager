import { cn } from "@/lib/utils"

interface StreakFlameProps {
  streak: number
  longestStreak: number
  className?: string
}

function getFlameIntensity(streak: number): string {
  if (streak >= 30) return "scale-125 drop-shadow-[0_0_18px_#f59e0b]"
  if (streak >= 7) return "scale-110 drop-shadow-[0_0_12px_#f59e0b]"
  if (streak >= 3) return "scale-105 drop-shadow-[0_0_6px_#f59e0b]"
  return ""
}

function StreakFlame({ streak, longestStreak, className }: StreakFlameProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 backdrop-blur-sm",
      className
    )}>
      <span className={cn(
        "text-4xl transition-all duration-500",
        streak > 0 ? "animate-pulse" : "opacity-30 grayscale",
        getFlameIntensity(streak)
      )}>
        🔥
      </span>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn(
            "text-2xl font-black tabular-nums",
            streak > 0 ? "text-amber-500" : "text-muted-foreground"
          )}>
            {streak}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {streak === 1 ? "day" : "days"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Longest: {longestStreak} days
        </p>
      </div>
    </div>
  )
}

export { StreakFlame }
