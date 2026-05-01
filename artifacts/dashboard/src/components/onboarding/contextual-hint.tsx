import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useOnboardingState, useDismissHint } from "@/hooks/use-onboarding";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb } from "lucide-react";

interface HintConfig {
  path: string;
  message: string;
}

const HINTS: HintConfig[] = [
  {
    path: "/jobs",
    message: "Tip: Click 'Ingest Job' to paste a job URL and let AI parse it for you.",
  },
  {
    path: "/base-resume",
    message: "Tip: Paste your resume text here. AI will use it to tailor versions for each job.",
  },
  {
    path: "/role-profiles",
    message: "Tip: Create a profile with your target title, skills, and salary range.",
  },
  {
    path: "/apply-wizard",
    message: "Tip: The wizard guides you through tailoring, reviewing, and applying step-by-step.",
  },
  {
    path: "/applications",
    message: "Tip: Track every application stage here. It feeds into your AI learning loop!",
  },
];

export function ContextualHint() {
  const location = useLocation();
  const { data: state } = useOnboardingState();
  const dismiss = useDismissHint();
  const [visible, setVisible] = useState(false);

  const hint = HINTS.find((h) => location.pathname.startsWith(h.path));

  useEffect(() => {
    if (!hint || !state) {
      setVisible(false);
      return;
    }
    const isDismissed = state.dismissedHints.includes(hint.path);
    setVisible(!isDismissed && !state.isComplete);
  }, [hint, state, location]);

  if (!hint || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    dismiss.mutate(hint.path);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative mx-6 mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 gamify-shadow"
        >
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-foreground">{hint.message}</p>
          <button
            onClick={handleDismiss}
            className="ml-auto rounded p-1 hover:bg-primary/10"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
