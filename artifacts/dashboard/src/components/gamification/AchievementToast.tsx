import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface AchievementToastProps {
  icon: string
  name: string
  description: string
  onDismiss: () => void
}

function AchievementToast({ icon, name, description, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn(
      "pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-amber-400/50 bg-card p-4 shadow-2xl transition-all duration-300",
      visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
    )}>
      <span className="text-3xl animate-bounce">{icon}</span>
      <div>
        <p className="text-sm font-bold text-amber-500">Achievement Unlocked!</p>
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

interface AchievementToasterProps {
  toasts: Array<{ id: string; icon: string; name: string; description: string }>
  onDismiss: (id: string) => void
}

function AchievementToaster({ toasts, onDismiss }: AchievementToasterProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <AchievementToast
          key={t.id}
          icon={t.icon}
          name={t.name}
          description={t.description}
          onDismiss={() => onDismiss(t.id)}
        />
      ))}
    </div>
  )
}

export { AchievementToast, AchievementToaster }
