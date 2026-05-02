import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Thin wrapper around a native <textarea>.
 *
 * Same rationale as Input — kept as a native element for react-hook-form
 * and InputGroup compatibility. Mantine's Textarea should be used directly
 * in new code where the full label/description/error chrome is wanted.
 */
const Textarea = React.forwardRef<
 HTMLTextAreaElement,
 React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
 return (
 <textarea
 className={cn(
 "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
 className
 )}
 ref={ref}
 {...props}
 />
 )
})
Textarea.displayName = "Textarea"

export { Textarea }
