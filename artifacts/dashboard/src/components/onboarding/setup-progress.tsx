import { useOnboardingState } from "@/hooks/use-onboarding";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";

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
    <div>
      <div>
        <span>Getting Started</span>
        <span>{state.progress}%</span>
      </div>
      <Progress value={state.progress} />
      <div>
        {STEPS.map((step) => {
          const isDone = state.completedSteps.includes(step.id);
          return (
            <div key={step.id}>
              {isDone ? <CheckCircle2 /> : <Circle />}
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
