import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--primary))] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-xl cursor-pointer select-none hover:animate-[wiggle_0.4s_ease-in-out]",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(var(--primary))] text-white hover:brightness-110 hover:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.5)] active:scale-[0.98]",
        primary:
          "bg-[hsl(var(--primary))] text-white hover:brightness-110 hover:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.5)] active:scale-[0.98]",
        outline:
          "bg-transparent text-[hsl(var(--foreground))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--primary)/0.06)] hover:border-[hsl(var(--primary)/0.2)] active:scale-[0.98]",
        secondary:
          "bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.15)] hover:bg-[hsl(var(--primary)/0.12)] active:scale-[0.98]",
        ghost:
          "bg-transparent text-[hsl(var(--muted))] hover:bg-[hsl(var(--foreground)/0.06)] hover:text-[hsl(var(--foreground))]",
        destructive:
          "bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive))] hover:brightness-110 active:scale-[0.98]",
        link: "text-[hsl(var(--primary))] underline-offset-4 hover:underline h-auto p-0 font-normal rounded-none active:scale-100 font-sans",
        gradient:
          "bg-[color:var(--accent)] text-white border border-[color:var(--accent)] hover:brightness-110 active:scale-[0.98]",
        quest:
          "bg-[hsl(var(--secondary)/0.15)] text-[hsl(var(--secondary))] border border-[hsl(var(--secondary)/0.3)] hover:bg-[hsl(var(--secondary)/0.22)] active:scale-[0.98]",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-3 text-xs rounded-lg",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-8 text-base rounded-2xl",
        icon: "h-11 w-11 p-0",
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
