import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
 "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2",
 {
 variants: {
 variant: {
 default:
 "bg-[hsl(var(--primary))] text-white",
 secondary:
 "bg-[hsl(var(--secondary))]/15 text-[hsl(var(--secondary))]",
 success:
 "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]",
 warning:
 "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
 destructive:
 "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]",
 outline:
 "bg-transparent text-[hsl(var(--foreground))] border border-[hsl(var(--border))]",
 },
 },
 defaultVariants: {
 variant: "default",
 },
 }
)

export interface BadgeProps
 extends React.HTMLAttributes<HTMLDivElement>,
 VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
 return (
 <div className={cn(badgeVariants({ variant }), className)} {...props} />
 )
}

export { Badge, badgeVariants }
