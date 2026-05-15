import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface MascotAvatarProps {
  className?: string
}

export function MascotAvatar({ className }: MascotAvatarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -8, 0],
        rotate: [0, -3, 3, 0],
      }}
      transition={{
        default: { delay: 1, type: "spring", stiffness: 300 },
        y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
      }}
      whileHover={{ scale: 1.15, rotate: 0 }}
      title="Your job search buddy!"
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "flex h-16 w-16 items-center justify-center rounded-full",
        " shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.5)]",
        "cursor-pointer select-none",
        className
      )}
    >
      <span className="text-3xl">🦊</span>
    </motion.div>
  )
}
