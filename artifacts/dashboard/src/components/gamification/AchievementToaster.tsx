import { AnimatePresence } from "framer-motion"
import { AchievementToast } from "./AchievementToast"

interface AchievementToastItem {
 id: string
 icon: string
 name: string
 description?: string
 tier?: "bronze" | "silver" | "gold"
}

interface AchievementToasterProps {
 toasts: AchievementToastItem[]
 onDismiss: (id: string) => void
}

function AchievementToaster({ toasts, onDismiss }: AchievementToasterProps) {
 return (
 <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
 <AnimatePresence>
 {toasts.map((t) => (
 <div key={t.id} className="pointer-events-auto">
 <AchievementToast
 name={t.name}
 icon={t.icon}
 tier={t.tier ?? "gold"}
 onDismiss={() => onDismiss(t.id)}
 />
 </div>
 ))}
 </AnimatePresence>
 </div>
 )
}

export { AchievementToaster }
