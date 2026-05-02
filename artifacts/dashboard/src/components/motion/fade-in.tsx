import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FadeInProps {
 children: React.ReactNode;
 className?: string;
 direction?: "up" | "down" | "left" | "right" | "none";
 delay?: number;
 duration?: number;
 once?: boolean;
}

export function FadeIn({
 children,
 className,
 direction = "up",
 delay = 0,
 duration = 0.4,
 once = true,
}: FadeInProps) {
 const shouldReduceMotion = useReducedMotion();

 const getInitial = () => {
 if (shouldReduceMotion) return {};
 switch (direction) {
 case "up": return { opacity: 0, y: 12 };
 case "down": return { opacity: 0, y: -12 };
 case "left": return { opacity: 0, x: 20 };
 case "right": return { opacity: 0, x: -20 };
 case "none": default: return { opacity: 0 };
 }
 };

 const getAnimate = () => {
 if (shouldReduceMotion) return { opacity: 1 };
 switch (direction) {
 case "up":
 case "down": return { opacity: 1, y: 0 };
 case "left":
 case "right": return { opacity: 1, x: 0 };
 case "none": default: return { opacity: 1 };
 }
 };

 const customVariants: Variants = {
 hidden: getInitial(),
 visible: {
 ...getAnimate(),
 transition: {
 duration,
 delay,
 ease: [0.22, 1, 0.36, 1],
 },
 },
 };

 return (
 <motion.div
 initial="hidden"
 whileInView="visible"
 viewport={{ once, margin: "-40px" }}
 variants={customVariants}
 className={cn("will-change-transform", className)}
 >
 {children}
 </motion.div>
 );
}
