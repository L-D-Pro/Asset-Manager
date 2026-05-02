import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

const paddingMap = {
  default: "p-5",
  none: "",
  sm: "p-3",
} as const;

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  index?: number;
  padding?: keyof typeof paddingMap;
  style?: CSSProperties;
}

export function ContentCard({
  children,
  className,
  index = 0,
  padding = "default",
  style,
}: ContentCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        shouldReduceMotion
          ? undefined
          : { y: -2, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
      }
      className={cn(
        "rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md text-card-foreground shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06),0_10px_20px_-2px_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:border-border/80",
        paddingMap[padding],
        className
      )}
      style={style}
    >
      {children}
    </motion.div>
  );
}