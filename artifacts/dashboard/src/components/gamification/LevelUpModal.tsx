import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface LevelUpModalProps {
  open: boolean
  oldLevel: number
  newLevel: number
  onClose: () => void
}

export function LevelUpModal({ open, oldLevel, newLevel, onClose }: LevelUpModalProps) {
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0, rotateZ: -10 }}
            animate={{ scale: 1, rotateZ: 0 }}
            exit={{ scale: 0, rotateZ: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="card-glass p-10 text-center max-w-sm mx-4"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 400 }}
              className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full gradient-hero shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.5)]"
            >
              <span className="text-5xl">⬆️</span>
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-3xl font-black text-foreground tracking-tight"
            >
              LEVEL UP!
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-2 text-muted-foreground"
            >
              Level {oldLevel} →{" "}
              <span className="font-extrabold text-primary text-xl">{newLevel}</span>
            </motion.p>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-4 text-sm text-muted-foreground italic"
            >
              "You're crushing it! 🔥"
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
