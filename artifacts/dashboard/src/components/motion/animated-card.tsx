import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  index?: number;
}

export function AnimatedCard({
  children,
  className,
  hover = true,
  index = 0,
  ...props
}: AnimatedCardProps) {
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
        hover && !shouldReduceMotion
          ? { y: -2, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
          : undefined
      }
      whileTap={
        hover && !shouldReduceMotion
          ? { scale: 0.995, transition: { duration: 0.1 } }
          : undefined
      }
      className={cn("will-change-transform", className)}
    >
      <Card
        className={cn(
          hover && "transition-shadow duration-300 hover:shadow-lg",
          className
        )}
        {...props}
      >
        {children}
      </Card>
    </motion.div>
  );
}
