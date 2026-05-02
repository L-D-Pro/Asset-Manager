import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface StreakFlameProps {
 days: number
 intensity?: "low" | "medium" | "high"
 className?: string
}

function getFlameConfig(days: number) {
 if (days >= 8)
 return {
 level: "high" as const,
 emojiSize: "text-5xl",
 bgGlow: "rounded-full",
 }
 if (days >= 5)
 return {
 level: "high" as const,
 emojiSize: "text-4xl",
 bgGlow: "rounded-full",
 }
 if (days >= 2)
 return {
 level: "medium" as const,
 emojiSize: "text-3xl",
 bgGlow: "rounded-full",
 }
 return {
 level: "low" as const,
 emojiSize: "text-2xl opacity-60",
 bgGlow: "",
 }
}

function StreakFlame({ days, intensity, className }: StreakFlameProps) {
 const { level, emojiSize, bgGlow } = getFlameConfig(days)
 const effectiveIntensity = intensity ?? level

 const floatAnimation = days >= 8
 const glowPulse = days >= 5

  return (
    <div
      className={cn(
        "card-glass flex flex-col items-center justify-center gap-3 p-6",
        className
      )}
    >
 <motion.div
 className="relative flex items-center justify-center"
 animate={
 floatAnimation
 ? { y: [0, -6, 0] }
 : glowPulse
 ? { scale: [1, 1.05, 1] }
 : {}
 }
 transition={
 floatAnimation
 ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
 : glowPulse
 ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
 : {}
 }
 >
 <div
 className={cn(
 "flex items-center justify-center p-2",
 bgGlow,
  effectiveIntensity === "high" && "animate-[pulse-glow-orange_2s_ease-in-out_infinite]"
 )}
 >
 <span className={cn(emojiSize, "transition-all duration-500")}>
 🔥
 </span>
 </div>
 <span
 className={cn(
 "absolute -top-1 -right-2 rounded-full min-w-[26px] h-[26px] flex items-center justify-center px-1 text-xs font-extrabold text-white font-display",
  days >= 5
  ? "bg-orange-500"
  : days >= 2
  ? "bg-orange-400"
  : "bg-muted"
 )}
 >
 {days}
 </span>
 </motion.div>

 <span className="text-sm font-bold text-foreground font-display">
 {days} day streak
 </span>
 </div>
 )
}

export { StreakFlame }
