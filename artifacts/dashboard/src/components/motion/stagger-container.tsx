import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { variants } from "@/lib/animations";

interface StaggerContainerProps {
 children: React.ReactNode;
 className?: string;
 staggerDelay?: number;
 delayChildren?: number;
}

export function StaggerContainer({
 children,
 className,
 staggerDelay = 0.05,
 delayChildren = 0.05,
}: StaggerContainerProps) {
 const shouldReduceMotion = useReducedMotion();

 const containerVariants = {
 hidden: {},
 visible: {
 transition: {
 staggerChildren: shouldReduceMotion ? 0 : staggerDelay,
 delayChildren: shouldReduceMotion ? 0 : delayChildren,
 },
 },
 };

 return (
 <motion.div
 initial="hidden"
 animate="visible"
 variants={containerVariants}
 className={cn(className)}
 >
 {children}
 </motion.div>
 );
}

interface StaggerItemProps {
 children: React.ReactNode;
 className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
 const shouldReduceMotion = useReducedMotion();

 const itemVariants = {
 hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
 visible: {
 opacity: 1,
 y: 0,
 transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
 },
 };

 return (
 <motion.div variants={itemVariants} className={cn("will-change-transform", className)}>
 {children}
 </motion.div>
 );
}
