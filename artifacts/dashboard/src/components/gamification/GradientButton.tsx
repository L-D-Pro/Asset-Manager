import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GradientButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag"> {
  variant?: "primary" | "secondary" | "ghost" | "quest";
  size?: "default" | "sm" | "lg";
  loading?: boolean;
  asChild?: boolean;
}

const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant = "primary", size = "default", loading, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : motion.button;
    const base = cn(
      "inline-flex items-center justify-center font-bold font-nunito tracking-tight",
      "border-none border-b-[4px] rounded-2xl cursor-pointer",
      "transition-all duration-100 ease-out",
      variant === "primary" && "bg-primary text-primary-foreground border-b-primary-dark",
      variant === "secondary" && "bg-transparent text-foreground border-2 border-border hover:border-primary hover:bg-surface",
      variant === "ghost" && "bg-transparent text-foreground border-none hover:bg-surface",
      variant === "quest" && "bg-accent text-primary-foreground border-b-accent-dark",
      size === "default" && "h-12 px-6 text-base",
      size === "sm" && "h-9 px-4 text-sm",
      size === "lg" && "h-14 px-8 text-lg",
      "active:border-b-[2px] active:translate-y-[2px]",
      (props.disabled || loading) && "opacity-60 cursor-not-allowed",
      className
    );
    return (
      <Comp ref={ref as any} className={base} whileTap={asChild ? undefined : { y: 2 }} {...(props as any)}>
        {loading ? (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </Comp>
    );
  }
);
GradientButton.displayName = "GradientButton";
export { GradientButton };
export type { GradientButtonProps };
