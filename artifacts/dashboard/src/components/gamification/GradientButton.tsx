import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const gradientButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 active:scale-[0.96] hover:scale-[1.02]",
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.7))] text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:brightness-110",
        secondary:
          "bg-[linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--secondary)/0.7))] text-secondary-foreground shadow-lg hover:brightness-105",
        ghost:
          "bg-transparent border-2 border-border/50 text-foreground hover:border-primary/30 hover:bg-muted/30 shadow-none hover:scale-[1.02] active:scale-[0.96]",
        quest:
          "bg-[linear-gradient(135deg,#f59e0b,#d97706)] text-white shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40",
      },
      size: {
        sm: "min-h-8 rounded-xl px-4 text-sm",
        md: "min-h-11 px-6 text-base",
        lg: "min-h-14 rounded-3xl px-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
  asChild?: boolean
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(gradientButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
GradientButton.displayName = "GradientButton"

export { GradientButton, gradientButtonVariants }
