import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { easing } from "@/lib/animations";
import { ContentCard } from "@/components/ui/content-card";

export default function NotFound() {
 const navigate = useNavigate();

 return (
 <div className="min-h-screen bg-surface flex items-center justify-center">
 <div className="card-chunky p-12 text-center max-w-md bg-background">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, ease: easing.smooth }}
 >
 <motion.div
 className="flex justify-center mb-6"
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ delay: 0.1, duration: 0.4, ease: easing.snappy }}
 >
 <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-warning/10 border border-warning/30">
 <AlertTriangle className="h-10 w-10 text-warning" />
 </div>
 </motion.div>

 <h1 className="text-4xl font-bold tracking-tight mb-2">404</h1>
 <h2 className="text-xl font-semibold text-muted-foreground mb-4">Page Not Found</h2>
 <p className="text-sm text-muted-foreground mb-8">
 The page you are looking for doesn't exist or has been moved.
 </p>

 <div className="flex items-center justify-center gap-3">
 <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
 <ArrowLeft className="h-4 w-4" />
 Go Back
 </Button>
 <Button onClick={() => navigate("/")} className="gap-2">
 <Home className="h-4 w-4" />
 Dashboard
 </Button>
 </div>
 </motion.div>
 </div>
 </div>
 );
}
