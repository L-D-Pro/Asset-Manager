import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Target, ClipboardList, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NextAction {
 id: string;
 title: string;
 description: string;
 href: string;
 priority: number;
 category: "setup" | "action" | "review";
}

const CATEGORY_ICONS = {
 setup: FileText,
 action: Target,
 review: ClipboardList,
};

const CATEGORY_COLORS = {
 setup: "from-amber-500/20 to-orange-500/10",
 action: "from-primary/20 to-accent/10",
 review: "from-emerald-500/20 to-teal-500/10",
};

async function apiGet(path: string) {
 const res = await fetch(`/api${path}`, { credentials: "include" });
 if (!res.ok) throw new Error(`GET ${path} failed`);
 return res.json();
}

export function NextActions() {
 const { data, isLoading } = useQuery<{ actions: NextAction[] }>({
 queryKey: ["next-actions"],
 queryFn: () => apiGet("/gamification/next-actions"),
 });

 if (isLoading) {
 return (
 <div className="grid gap-4 md:grid-cols-3">
 {[1, 2, 3].map((i) => (
 <div
 key={i}
 className="h-32 animate-pulse rounded-2xl bg-muted"
 />
 ))}
 </div>
 );
 }

 const actions = data?.actions ?? [];

 if (actions.length === 0) {
 return (
 <div className="rounded-2xl border border-border bg-card/50 p-6 text-center">
 <Wand2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
 <h3 className="font-semibold">You&apos;re all caught up!</h3>
 <p className="text-sm text-muted-foreground">
 Check out Trends or ingest a new job to keep momentum.
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-3">
 <h2 className="text-lg font-semibold tracking-tight">What&apos;s Next?</h2>
 <div className="grid gap-4 md:grid-cols-3">
 {actions.map((action, i) => {
 const Icon = CATEGORY_ICONS[action.category];
 return (
 <motion.div
 key={action.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.1 }}
 >
 <Link
 to={action.href}
 className={cn(
 "group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30",
 CATEGORY_COLORS[action.category],
 )}
 >
 <div className="mb-3 flex items-center justify-between">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80">
 <Icon className="h-5 w-5 text-foreground" />
 </div>
 <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
 </div>
 <h3 className="font-semibold">{action.title}</h3>
 <p className="mt-1 text-sm text-muted-foreground">
 {action.description}
 </p>
 </Link>
 </motion.div>
 );
 })}
 </div>
 </div>
 );
}
