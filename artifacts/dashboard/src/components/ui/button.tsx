import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
 "inline-flex items-center justify-center gap-2 whitespace-nowrap font-[family-name:var(--font-display)] font-bold transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--primary))] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-[16px] cursor-pointer select-none",
 {
 variants: {
 variant: {
 default:
 "bg-[hsl(var(--primary))] text-white border-b-[4px] border-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-dark))] active:translate-y-[2px] active:border-b-[2px]",
 primary:
 "bg-[hsl(var(--primary))] text-white border-b-[4px] border-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-dark))] active:translate-y-[2px] active:border-b-[2px]",
 outline:
 "bg-transparent text-[hsl(var(--foreground))] border-2 border-[hsl(var(--border))] border-b-[6px] hover:bg-[hsl(var(--surface))] hover:border-[hsl(var(--primary))]/30 active:translate-y-[2px] active:border-b-[2px]",
 secondary:
 "bg-transparent text-[hsl(var(--primary))] border-2 border-[hsl(var(--border))] border-b-[6px] hover:bg-[hsl(var(--surface))] active:translate-y-[2px] active:border-b-[2px]",
 ghost:
 "bg-transparent text-[hsl(var(--muted))] hover:bg-[hsl(var(--surface))] hover:text-[hsl(var(--foreground))]",
 destructive:
 "bg-[hsl(var(--destructive))] text-white border-b-[4px] border-[hsl(0,100%,50%)] hover:bg-[hsl(0,100%,55%)] active:translate-y-[2px] active:border-b-[2px]",
 link: "text-[hsl(var(--primary))] underline-offset-4 hover:underline h-auto p-0 font-normal rounded-none active:translate-y-0 font-sans",
 },
 size: {
 default: "h-14 px-6 text-base",
 sm: "h-12 px-4 text-sm rounded-xl",
 md: "h-14 px-6 text-base",
 lg: "h-16 px-8 text-lg rounded-[18px]",
 icon: "h-14 w-14 p-0",
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
