import { useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

interface TiltCardProps {
  children: React.ReactNode
  className?: string
  tiltAmount?: number
  perspective?: number
  scale?: number
  glowColor?: string
  gradient?: "blue" | "purple" | "orange" | "green" | "none"
}

const gradientMap = {
  blue: "from-primary/20 via-primary/5 to-transparent",
  purple: "from-secondary/20 via-secondary/5 to-transparent",
  orange: "from-orange-500/20 via-orange-500/5 to-transparent",
  green: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  none: "",
}

export function TiltCard({
  children,
  className,
  tiltAmount = 10,
  perspective = 1000,
  scale = 1.02,
  glowColor = "hsl(var(--primary) / 0.15)",
  gradient = "none",
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springConfig = { stiffness: 300, damping: 30 }
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [tiltAmount, -tiltAmount]), springConfig)
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-tiltAmount, tiltAmount]), springConfig)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const xPos = (e.clientX - rect.left) / rect.width - 0.5
    const yPos = (e.clientY - rect.top) / rect.height - 0.5
    x.set(xPos)
    y.set(yPos)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        gradient !== "none" && `bg-gradient-to-br ${gradientMap[gradient]}`,
        className
      )}
      style={{
        perspective,
        transformStyle: "preserve-3d",
        rotateX,
        rotateY,
        scale: isHovered ? scale : 1,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      transition={{ scale: { duration: 0.2 } }}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          boxShadow: isHovered ? `0 0 40px -10px ${glowColor}` : "none",
        }}
      />
      
      {/* Inner content with subtle parallax */}
      <motion.div
        style={{
          transformStyle: "preserve-3d",
          translateZ: 20,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
