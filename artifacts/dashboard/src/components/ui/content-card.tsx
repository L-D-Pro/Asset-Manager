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
 : { y: -1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
 }
 className={cn(
 "rounded-2xl border border-border/70 bg-card text-card-foreground transition-all duration-300 hover:border-primary/35",
 paddingMap[padding],
 className
 )}
 style={style}
 >
 {children}
 </motion.div>
 );
}
