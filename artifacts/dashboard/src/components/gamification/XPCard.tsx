import { ProgressRing } from "./ProgressRing"
import { cn } from "@/lib/utils"

interface XPCardProps {
  totalXp: number
  currentLevel: number
  xpToNextLevel: number
  className?: string
}

function XPCard({ totalXp, currentLevel, xpToNextLevel, className }: XPCardProps) {
  const levelFloor = (currentLevel - 1) * (currentLevel - 1) * 100
  const progress = xpToNextLevel > 0 ? (totalXp - levelFloor) / (xpToNextLevel + totalXp - levelFloor) : 1

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-border/50 bg-[linear-gradient(145deg,hsl(var(--card)),hsl(var(--card))_50%,hsl(var(--primary)/0.04))] p-5 backdrop-blur-sm",
      className
    )}>
      <div className="flex items-center gap-4">
        <ProgressRing progress={progress} size={72} strokeWidth={5}>
          <span className="text-xl font-bold text-foreground">{currentLevel}</span>
        </ProgressRing>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Level {currentLevel}</p>
          <p className="text-lg font-bold text-foreground">{totalXp.toLocaleString()} XP</p>
          <p className="text-xs text-muted-foreground mt-1">
            {xpToNextLevel.toLocaleString()} XP to Level {currentLevel + 1}
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)/0.7))] shadow-[0_0_10px_-2px_hsl(var(--primary)/0.5)] transition-all duration-700"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export { XPCard }
