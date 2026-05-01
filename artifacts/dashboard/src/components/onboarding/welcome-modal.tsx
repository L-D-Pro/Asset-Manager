import { useState, useEffect } from "react";
import { useOnboardingState, useMarkWelcomeSeen } from "@/hooks/use-onboarding";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GradientButton } from "@/components/gamification/GradientButton";
import { motion } from "framer-motion";
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
      <DialogContent className="gamify-radius-chunky max-w-lg border-2 border-primary/20 gamify-shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" />
            Welcome to Job Ops
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-muted-foreground">
            Let&apos;s get you set up for job search success. Here&apos;s what you can do:
          </p>
          <div className="space-y-3">
            {WELCOME_STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="flex items-start gap-3 rounded-xl bg-muted/50 p-3"
              >
                <div className="gamify-gradient-warm flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <step.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
          <GradientButton
            onClick={handleClose}
            className="w-full"
            size="lg"
          >
            Let&apos;s Go!
          </GradientButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
