import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indeterminate?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            indeterminate
              ? "w-full animate-indeterminate-progress bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-light))_50%,hsl(var(--primary-dark))_100%)]"
              : "gamify-gradient-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]"
          )}
          style={
            indeterminate
              ? undefined
              : { width: `${Math.min(Math.max(value, 0), 100)}%` }
          }
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
export type { ProgressProps }
