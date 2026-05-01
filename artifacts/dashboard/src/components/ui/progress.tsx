import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indeterminate,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indeterminate?: boolean
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 rounded-full",
          indeterminate
            ? "animate-indeterminate-progress bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.5)_50%,hsl(var(--primary))_100%)]"
            : "bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)] transition-all duration-500"
        )}
        style={{
          transform: indeterminate
            ? undefined
            : `translateX(-${100 - (value || 0)}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
