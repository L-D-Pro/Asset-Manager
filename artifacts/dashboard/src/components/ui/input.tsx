import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Thin wrapper around a native <input>.
 *
 * Mantine styling is inherited from the MantineProvider context
 * (fonts, radius, color scheme). We keep the raw <input> here because
 * many consumers (InputGroup, react-hook-form register()) rely on the
 * exact native element ref and prop surface.
 *
 * Mantine's TextInput should be used directly in new code where the
 * full Mantine label/description/error chrome is wanted.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
