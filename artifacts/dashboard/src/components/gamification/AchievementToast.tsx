import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface AchievementToastProps {
 name: string
 icon: string
 tier?: "bronze" | "silver" | "gold"
 onDismiss: () => void
}

function AchievementToast({
 name,
 icon,
 tier = "gold",
 onDismiss,
}: AchievementToastProps) {
 useEffect(() => {
 const timer = setTimeout(onDismiss, 4000)
 return () => clearTimeout(timer)
 }, [onDismiss])

 return (
 <motion.div
 initial={{ x: 80, opacity: 0, scale: 0.95 }}
 animate={{ x: 0, opacity: 1, scale: 1 }}
 exit={{ x: 80, opacity: 0, scale: 0.95 }}
 transition={{ type: "spring", duration: 0.5 }}
 className={cn(
 "card-chunky flex items-center gap-3 p-4",
 "bg-primary text-white border-0"
 )}
 style={{ boxShadow: "0 6px 0 rgba(0,0,0,0.15)" }}
 >
 <motion.span
 className="text-2xl shrink-0"
 animate={{ scale: [1, 1.2, 1] }}
 transition={{ duration: 0.5, delay: 0.2 }}
 >
 {icon}
 </motion.span>
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
 Achievement Unlocked!
 </p>
 <p className="text-sm font-bold truncate">{name}</p>
 </div>
 <button
 onClick={onDismiss}
 className="shrink-0 text-white/60 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
 >
 ×
 </button>
 </motion.div>
 )
}

export { AchievementToast }
