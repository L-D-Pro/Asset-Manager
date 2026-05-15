import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface FloatingXPProps {
  xp: number
  key: string | number
}

export function FloatingXP({ xp, key }: FloatingXPProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [key])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={key}
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -60, scale: 1.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="pointer-events-none fixed z-[200] font-extrabold text-2xl tracking-tight  animate-fade-slide-up"
        >
          +{xp} XP
        </motion.div>
      )}
    </AnimatePresence>
  )
}
