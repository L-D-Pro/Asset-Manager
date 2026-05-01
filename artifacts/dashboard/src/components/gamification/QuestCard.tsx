import { GradientButton } from "./GradientButton"
import { cn } from "@/lib/utils"

interface QuestCardProps {
  questId: number
  name: string
  description: string
  xpReward: number
  progress: number
  criteriaValue: number
  status: "active" | "completed"
  frequency?: string
  onAccept?: (questId: number) => void
  className?: string
}

function QuestCard({ questId, name, description, xpReward, progress, criteriaValue, status, frequency, onAccept, className }: QuestCardProps) {
  const completed = status === "completed" || progress >= criteriaValue
  const pct = Math.min((progress / criteriaValue) * 100, 100)

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all",
      completed
        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
        : "border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30",
      className
    )}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className={cn(
            "font-bold text-sm",
            completed ? "text-emerald-800 dark:text-emerald-200" : "text-foreground"
          )}>
            {completed ? "✓ " : ""}{name}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-bold",
          completed
            ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
            : "bg-primary/10 text-primary"
        )}>
          +{xpReward} XP
        </span>
      </div>
      {!completed && (
        <>
          <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)/0.7))] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">{progress}/{criteriaValue}</span>
            {frequency && (
              <span className="text-[11px] text-muted-foreground capitalize">{frequency}</span>
            )}
          </div>
        </>
      )}
      {onAccept && (
        <GradientButton
          size="sm"
          variant="ghost"
          className="w-full mt-3"
          onClick={() => onAccept(questId)}
        >
          Accept
        </GradientButton>
      )}
    </div>
  )
}

export { QuestCard }
