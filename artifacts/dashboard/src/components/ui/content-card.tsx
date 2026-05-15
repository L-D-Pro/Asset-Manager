import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Legacy content card — re-skinned for Quiet Operations.
 *
 * Originally a glass-morphism card with hover lift and a 12px translate
 * entrance. The new treatment is a quiet bordered paper card with a single
 * soft shadow on hover. Entrance animation is preserved but simplified to a
 * 4px rise (no scale, no glass blur).
 *
 * API preserved so existing call sites keep compiling.
 */

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
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? {} : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={cn("quiet-card", paddingMap[padding], className)}
      style={style}
    >
      {children}
    </motion.div>
  );
}
