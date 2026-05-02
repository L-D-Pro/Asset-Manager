import { useOnboardingState } from "@/hooks/use-onboarding";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
 { id: "resume", label: "Add your resume" },
 { id: "role_profile", label: "Create role profile" },
 { id: "first_job", label: "Ingest a job" },
 { id: "wizard", label: "Try the wizard" },
 { id: "application", label: "Track application" },
];

export function SetupProgress() {
 const { data: state } = useOnboardingState();
 if (!state) return null;
 if (state.isComplete) return null;

 return (
 <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
 <div className="mb-2 flex items-center justify-between">
 <span className="text-xs font-semibold text-sidebar-foreground">
 Getting Started
 </span>
 <span className="text-xs font-medium text-sidebar-primary">
 {state.progress}%
 </span>
 </div>
 <Progress
 value={state.progress}
 className="h-1.5"
 />
 <div className="mt-2 space-y-1">
 {STEPS.map((step) => {
 const isDone = state.completedSteps.includes(step.id);
 return (
 <div
 key={step.id}
 className={cn(
 "flex items-center gap-1.5 text-[10px]",
 isDone
 ? "text-sidebar-foreground/60"
 : "text-sidebar-foreground/40",
 )}
 >
 {isDone ? (
 <CheckCircle2 className="h-3 w-3 text-emerald-500" />
 ) : (
 <Circle className="h-3 w-3" />
 )}
 <span className={cn(isDone && "line-through")}>
 {step.label}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 );
}
