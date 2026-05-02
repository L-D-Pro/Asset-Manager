import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { Trophy, Medal } from "lucide-react"

interface LeaderboardEntry {
  name: string
  xp: number
  isYou?: boolean
}

interface LeaderboardStripProps {
  entries: LeaderboardEntry[]
  className?: string
}

const MEDAL_COLORS = ["text-amber-500", "text-slate-400", "text-orange-700"]

export function LeaderboardStrip({ entries, className }: LeaderboardStripProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("card-glass p-5", className)}
    >
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold text-foreground text-sm tracking-tight">Leaderboard</h3>
      </div>
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div
            key={entry.name}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl transition-colors",
              entry.isYou && "bg-primary/8 border border-primary/20"
            )}
          >
            <span className={cn(
              "w-6 text-center text-sm font-extrabold",
              i < 3 ? MEDAL_COLORS[i] : "text-muted",
              entry.isYou && "text-primary"
            )}>
              {i < 3 ? (
                <Medal className="h-4 w-4 inline" />
              ) : (
                `#${i + 1}`
              )}
            </span>
            <span className={cn(
              "flex-1 text-sm font-semibold",
              entry.isYou ? "text-primary" : "text-foreground"
            )}>
              {entry.name}{entry.isYou ? " (You)" : ""}
            </span>
            <span className="text-xs font-bold text-muted flex items-center gap-1">
              ⚡ {entry.xp.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
