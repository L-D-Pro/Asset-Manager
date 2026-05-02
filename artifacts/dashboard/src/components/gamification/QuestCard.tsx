import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { GradientButton } from "./GradientButton"

interface QuestCardProps {
  title: string
  description: string
  progress: number // 0-100
  reward: string // e.g. "+50 XP"
  emoji: string
  onAccept?: () => void
  className?: string
}

export function QuestCard({ title, description, progress, reward, emoji, onAccept, className }: QuestCardProps) {
  const isComplete = progress >= 100
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn("card-glass p-5 space-y-3", isComplete && "border-primary/30", className)}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl",
          isComplete ? "gradient-hero" : "bg-secondary/10",
        )}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground text-sm truncate">{title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        </div>
      </div>
      {!isComplete && (
        <>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full gradient-hero transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {progress}% complete
            </span>
            <span className="text-[10px] font-extrabold text-secondary uppercase tracking-widest">
              {reward}
            </span>
          </div>
        </>
      )}
      {isComplete && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-success">Complete! 🎉</span>
          <button
            onClick={onAccept}
            className="text-xs font-bold text-primary hover:underline"
          >
            Claim reward
          </button>
        </div>
      )}
    </motion.div>
  )
}
