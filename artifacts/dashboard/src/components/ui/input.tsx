import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full bg-[hsl(var(--background))] border-0 border-b-2 border-[hsl(var(--border))] px-4 py-3 text-base font-sans text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted))] transition-colors duration-150 focus:outline-none focus:border-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
