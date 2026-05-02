import { useEffect, useState, useRef } from "react";
import { useReducedMotion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
 value: number;
 duration?: number;
 decimals?: number;
 prefix?: string;
 suffix?: string;
 className?: string;
}

export function AnimatedCounter({
 value,
 duration = 1.2,
 decimals = 0,
 prefix = "",
 suffix = "",
 className,
}: AnimatedCounterProps) {
 const [display, setDisplay] = useState(0);
 const ref = useRef<HTMLSpanElement>(null);
 const isInView = useInView(ref, { once: true, margin: "-20px" });
 const shouldReduceMotion = useReducedMotion();
 const hasAnimated = useRef(false);

 useEffect(() => {
 if (!isInView || hasAnimated.current) return;
 hasAnimated.current = true;

 if (shouldReduceMotion) {
 setDisplay(value);
 return;
 }

 const startTime = performance.now();
 const startValue = 0;

 const animate = (currentTime: number) => {
 const elapsed = currentTime - startTime;
 const progress = Math.min(elapsed / (duration * 1000), 1);

 // Ease-out cubic
 const easeOut = 1 - Math.pow(1 - progress, 3);
 const current = startValue + (value - startValue) * easeOut;

 setDisplay(current);

 if (progress < 1) {
 requestAnimationFrame(animate);
 }
 };

 requestAnimationFrame(animate);
 }, [isInView, value, duration, shouldReduceMotion]);

 const formatted = decimals > 0
 ? display.toFixed(decimals)
 : Math.round(display).toLocaleString();

 return (
 <span ref={ref} className={cn(className)}>
 {prefix}{formatted}{suffix}
 </span>
 );
}
