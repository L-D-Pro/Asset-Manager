import { cn } from "@/lib/utils"
import { ProgressRing } from "./ProgressRing"

interface XPCardProps {
 level: number
 currentXp: number
 xpToNext: number
 totalXp: number
 className?: string
}

function XPCard({ level, currentXp, xpToNext, totalXp, className }: XPCardProps) {
 const progress = xpToNext > 0 ? Math.min((currentXp / xpToNext) * 100, 100) : 100

 return (
 <div className={cn("card-chunky flex flex-col items-center gap-4", className)}>
 <ProgressRing
 progress={progress}
 size={100}
 strokeWidth={8}
 label={String(level)}
 />

 <div className="w-full space-y-1.5">
 <div className="h-3 rounded-full bg-[hsl(var(--border))] overflow-hidden">
 <div
 className="h-full rounded-full bg-primary transition-all duration-500"
 style={{ width: `${progress}%` }}
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted">
 {currentXp.toLocaleString()} / {xpToNext.toLocaleString()}
 </span>
 <span className="text-xs font-bold text-foreground flex items-center gap-0.5">
 ⚡ {totalXp.toLocaleString()} XP
 </span>
 </div>
 </div>
 </div>
 )
}

export { XPCard }
