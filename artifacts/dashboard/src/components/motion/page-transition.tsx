import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

const pageTransition = {
 initial: { opacity: 0, y: 8 },
 animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
 exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
 const location = useLocation();

 return (
 <AnimatePresence mode="wait">
 <motion.div
 key={location.pathname}
 initial="initial"
 animate="animate"
 exit="exit"
 variants={pageTransition}
 className="will-change-transform"
 >
 {children}
 </motion.div>
 </AnimatePresence>
 );
}
