import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import authRouter from "./auth";
import healthRouter from "./health";
import roleProfilesRouter from "./role-profiles";
import baseResumeRouter from "./base-resume";
import jobsRouter from "./jobs";
import claimsRouter from "./claims";
import resumeVersionsRouter from "./resume-versions";
import resumeTemplatesRouter from "./resume-templates";
import coverLetterVersionsRouter from "./cover-letter-versions";
import applicationsRouter from "./applications";
import eventLogsRouter from "./event-logs";
import feedbackSignalsRouter from "./feedback-signals";
import aiModelConfigsRouter from "./ai-model-configs";
import aiLearningRouter from "./ai-learning";
import aiPipelineRouter from "./ai-pipeline";
import { aiMetricsSnapshotRouter } from "./ai-metrics-snapshot";
import assistedApplyRouter from "./assisted-apply";
import freelanceRouter from "./freelance";
import usersRouter from "./users";
import adminResetRouter from "./admin-reset";
import adminHealthRouter from "./admin-health";
import wizardSessionsRouter from "./wizard-sessions";
import inviteCodesRouter from "./invite-codes";
import usageLimitsRouter from "./usage-limits";
import growthRouter from "./growth";
import feedbackRouter from "./feedback";
import trendsRouter from "./trends";
import jobBoardRouter from "./job-board";
import uiShellConfigsRouter from "./ui-shell-configs";
import gamificationRouter from "./gamification";
import onboardingRouter from "./onboarding";
import bestPracticesRouter from "./best-practices";

import resumeToProfileRouter from "./resume-to-profile";
import resumeScoringRouter from "./resume-scoring";

/**
 * Root API router. Aggregates all entity-specific sub-routers and mounts them
 * at the `/api` prefix (set in `app.ts`).
 *
 * Auth routes and health check are mounted WITHOUT `requireAuth` so they remain public.
 * All other routes are gated behind `requireAuth`, which validates the session.
 *
 * Route groups:
 * - `authRouter`              — POST /auth/login, /auth/logout, /auth/login/totp, GET /auth/me, etc.
 * - `healthRouter`            — GET /healthz (public — used by load balancers)
 * - `roleProfilesRouter`      — CRUD /role-profiles
 * - `jobsRouter`              — CRUD /jobs + AI trigger sub-routes
 * - `claimsRouter`            — CRUD /claims
 * - `resumeVersionsRouter`    — CRUD /resume-versions + approve/reject state machine
 * - `coverLetterVersionsRouter` — CRUD /cover-letter-versions + approve/reject
 * - `applicationsRouter`      — CRUD /applications + stats
 * - `eventLogsRouter`         — GET /event-logs (read-only)
 * - `feedbackSignalsRouter`   — CRUD /feedback-signals
 * - `aiModelConfigsRouter`    — CRUD /ai-model-configs
 */
const router: IRouter = Router();

// Public routes — no auth required
router.use(authRouter);
router.use(healthRouter);
router.use(inviteCodesRouter);
router.use(growthRouter);

// Protected routes — require a valid authenticated session
router.use(requireAuth);
  router.use(roleProfilesRouter);
  router.use(resumeToProfileRouter);
  router.use(baseResumeRouter);
router.use(jobsRouter);
router.use(claimsRouter);
router.use(resumeVersionsRouter);
router.use(resumeTemplatesRouter);
router.use(coverLetterVersionsRouter);
router.use(applicationsRouter);
router.use(eventLogsRouter);
router.use(feedbackSignalsRouter);
router.use(aiModelConfigsRouter);
router.use(aiLearningRouter);
router.use(aiPipelineRouter);
router.use(aiMetricsSnapshotRouter);
router.use(assistedApplyRouter);
router.use(freelanceRouter);
router.use(usersRouter);
router.use(adminResetRouter);
router.use(adminHealthRouter);
router.use(wizardSessionsRouter);
router.use(usageLimitsRouter);
router.use(feedbackRouter);
router.use(trendsRouter);
router.use(jobBoardRouter);
router.use(uiShellConfigsRouter);
router.use(gamificationRouter);
router.use(onboardingRouter);
router.use(bestPracticesRouter);
router.use(resumeToProfileRouter);

export default router;
