import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface GamifiedBadgeProps {
 name: string
 icon: string
 tier?: "bronze" | "silver" | "gold"
 unlocked?: boolean
 isNew?: boolean
 className?: string
}

const tierColors: Record<
 string,
 { border: string; bg: string }
> = {
 bronze: { border: "#CD7F32", bg: "rgba(205,127,50,0.12)" },
 silver: { border: "#C0C0C0", bg: "rgba(192,192,192,0.12)" },
 gold: { border: "hsl(var(--warning))", bg: "rgba(255,200,0,0.12)" },
}

function GamifiedBadge({
 name,
 icon,
 tier = "bronze",
 unlocked = true,
 isNew,
 className,
}: GamifiedBadgeProps) {
 const { border, bg } = tierColors[tier] ?? tierColors.bronze

 return (
 <motion.div
 whileTap={{ scale: 0.92 }}
 className={cn("flex flex-col items-center gap-2", className)}
 >
 <div className="relative">
 <div
 className={cn(
 "w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-300",
 !unlocked && "grayscale opacity-40"
 )}
 style={{
 border: `3px solid ${border}`,
 background: unlocked
 ? bg
 : undefined,
 }}
 >
 <span className="text-2xl">{icon}</span>
 </div>
 {isNew && (
 <span className="absolute -top-2 -right-5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-white font-display">
 NEW
 </span>
 )}
 </div>
 <span className="text-xs font-bold text-foreground text-center leading-tight max-w-[80px]">
 {name}
 </span>
 </motion.div>
 )
}

export { GamifiedBadge }
