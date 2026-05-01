import { Router, type IRouter } from "express";
import {
  getOrCreateOnboardingState,
  markWelcomeSeen,
  completeStep,
  dismissHint,
  calculateProgress,
  isOnboardingComplete,
  type OnboardingStep,
} from "../lib/onboarding";
import type { JobOpsRequest } from "../lib/http-types";

const router: IRouter = Router();

router.get("/onboarding/state", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const state = await getOrCreateOnboardingState(userId);
  res.json({
    ...state,
    progress: calculateProgress(state),
    isComplete: isOnboardingComplete(state),
  });
});

router.post("/onboarding/welcome-seen", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const state = await markWelcomeSeen(userId);
  res.json({
    ...state,
    progress: calculateProgress(state),
    isComplete: isOnboardingComplete(state),
  });
});

router.post("/onboarding/complete-step", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const { step } = req.body as { step: OnboardingStep };

  if (!step || !["resume", "role_profile", "first_job", "wizard", "application"].includes(step)) {
    res.status(400).json({ error: "Invalid step" });
    return;
  }

  const state = await completeStep(userId, step);
  res.json({
    ...state,
    progress: calculateProgress(state),
    isComplete: isOnboardingComplete(state),
  });
});

router.post("/onboarding/dismiss-hint", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const { pagePath } = req.body as { pagePath: string };

  if (!pagePath || typeof pagePath !== "string") {
    res.status(400).json({ error: "Invalid pagePath" });
    return;
  }

  const state = await dismissHint(userId, pagePath);
  res.json({
    ...state,
    progress: calculateProgress(state),
    isComplete: isOnboardingComplete(state),
  });
});

export default router;
