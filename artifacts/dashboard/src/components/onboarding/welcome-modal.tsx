import { useState, useEffect } from "react";
import { useOnboardingState, useMarkWelcomeSeen } from "@/hooks/use-onboarding";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, FileText, Rocket } from "lucide-react";

const WELCOME_STEPS = [
  {
    icon: FileText,
    title: "Build Your Foundation",
    description: "Add your base resume and create role profiles for AI-powered matching.",
  },
  {
    icon: Target,
    title: "Track Opportunities",
    description: "Ingest jobs, get AI-powered scores, and manage your pipeline.",
  },
  {
    icon: Rocket,
    title: "Apply with Confidence",
    description: "Use the Apply Wizard for guided resume tailoring and cover letters.",
  },
];

export function WelcomeModal() {
  const { data: state } = useOnboardingState();
  const markSeen = useMarkWelcomeSeen();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state && !state.hasSeenWelcome) {
      setOpen(true);
    }
  }, [state]);

  const handleClose = () => {
    setOpen(false);
    markSeen.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Sparkles />
            Welcome to Job Ops
          </DialogTitle>
          <DialogDescription>
            Let&apos;s get you set up for job search success.
          </DialogDescription>
        </DialogHeader>
        <div>
          <p>
            Let&apos;s get you set up for job search success. Here&apos;s what you can do:
          </p>
          <div>
            {WELCOME_STEPS.map((step) => (
              <div key={step.title}>
                <div>
                  <step.icon />
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={handleClose}>Let&apos;s Go!</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
