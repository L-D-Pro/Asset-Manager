import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { variants } from "@/lib/animations";

export function PageTransition({ children }: { children: React.ReactNode }) {
 const location = useLocation();

 return (
 <AnimatePresence mode="wait">
 <motion.div
 key={location.pathname}
 initial="initial"
 animate="animate"
 exit="exit"
 variants={variants.pageTransition}
 className="will-change-transform"
 >
 {children}
 </motion.div>
 </AnimatePresence>
 );
}
