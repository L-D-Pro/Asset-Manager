import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface GradientButtonProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  loading?: boolean
  variant?: "primary" | "secondary" | "ghost"
  type?: "button" | "submit"
}

const sizeMap = {
  sm: "h-12 px-5 text-sm",
  md: "h-14 px-7 text-base",
  lg: "h-16 px-10 text-lg",
}

function GradientButton({
  children,
  onClick,
  className,
  size = "md",
  disabled,
  loading,
  variant = "primary",
  type = "button",
}: GradientButtonProps) {
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "secondary"
        ? "btn-secondary"
        : "btn-ghost"

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      className={cn(
        variantClass,
        sizeMap[size],
        (disabled || loading) && "opacity-60 shadow-none cursor-not-allowed",
        className
      )}
    >
      {loading ? (
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        children
      )}
    </motion.button>
  )
}

export { GradientButton }
export type { GradientButtonProps }
