import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const paddingMap = {
  default: "p-6",
  none: "",
  sm: "p-4",
} as const;

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  index?: number;
  padding?: keyof typeof paddingMap;
}

export function ContentCard({
  children,
  className,
  index = 0,
  padding = "default",
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
        "rounded-2xl bg-white/80 backdrop-blur-sm border border-white/50 shadow-sm hover:shadow-md transition-all duration-300",
        paddingMap[padding],
        className
      )}
    >
      {children}
    </motion.div>
  );
}
