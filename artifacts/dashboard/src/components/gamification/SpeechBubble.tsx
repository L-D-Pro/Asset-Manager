import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface SpeechBubbleProps {
  message: string
  show: boolean
  onDismiss?: () => void
  className?: string
}

const MESSAGES = [
  "You're on fire! 🔥",
  "Keep going! 💪",
  "Almost there! 🎯",
  "Great progress! ⭐",
  "Level up incoming! ⬆️",
  "Look at you go! 🚀",
  "Unstoppable! 💎",
]

export function SpeechBubble({ message, show, onDismiss, className }: SpeechBubbleProps) {
  const text = message || MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

  useEffect(() => {
    if (!show || !onDismiss) return
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [show, onDismiss])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={cn(
            "card-glass p-3 px-4 text-sm font-bold text-foreground tracking-tight relative",
            "after:content-[''] after:absolute after:-bottom-2 after:left-6 after:w-4 after:h-4",
            "after:bg-card/70 after:border-r after:border-b after:border-border/50",
            "after:rotate-45 after:backdrop-blur-md",
            className
          )}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
