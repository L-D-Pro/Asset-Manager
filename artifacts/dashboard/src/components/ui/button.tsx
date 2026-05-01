import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110",
        destructive:
          "bg-[linear-gradient(135deg,hsl(var(--destructive)),hsl(var(--destructive)/0.8))] text-destructive-foreground shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/30 hover:brightness-110",
        outline:
          "border-2 border-primary/30 bg-background/50 backdrop-blur-sm text-foreground hover:bg-primary/5 hover:border-primary/50 shadow-sm",
        secondary:
          "bg-[linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--secondary)/0.8))] text-secondary-foreground shadow-md hover:brightness-105",
        ghost: "border-2 border-transparent text-foreground hover:bg-muted/50 hover:border-border/50",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto font-normal rounded-none shadow-none active:scale-100",
      },
      size: {
        default: "min-h-10 px-5 py-2.5",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-12 rounded-2xl px-8 text-base",
        icon: "h-10 w-10 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
