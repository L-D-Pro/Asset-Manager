import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roleProfilesRouter from "./role-profiles";
import jobsRouter from "./jobs";
import claimsRouter from "./claims";
import resumeVersionsRouter from "./resume-versions";
import coverLetterVersionsRouter from "./cover-letter-versions";
import applicationsRouter from "./applications";
import eventLogsRouter from "./event-logs";
import feedbackSignalsRouter from "./feedback-signals";
import aiModelConfigsRouter from "./ai-model-configs";

/**
 * Root API router. Aggregates all entity-specific sub-routers and mounts them
 * at the `/api` prefix (set in `app.ts`).
 *
 * Each sub-router owns all routes for its entity group:
 * - `healthRouter`            — GET /healthz
 * - `roleProfilesRouter`      — CRUD /role-profiles
 * - `jobsRouter`              — CRUD /jobs + AI trigger sub-routes (parse, score, tailor, cover-letter)
 * - `claimsRouter`            — CRUD /claims
 * - `resumeVersionsRouter`    — CRUD /resume-versions + approve/reject state machine
 * - `coverLetterVersionsRouter` — CRUD /cover-letter-versions + approve/reject
 * - `applicationsRouter`      — CRUD /applications + stats
 * - `eventLogsRouter`         — GET /event-logs (read-only)
 * - `feedbackSignalsRouter`   — CRUD /feedback-signals
 * - `aiModelConfigsRouter`    — CRUD /ai-model-configs
 */
const router: IRouter = Router();

router.use(healthRouter);
router.use(roleProfilesRouter);
router.use(jobsRouter);
router.use(claimsRouter);
router.use(resumeVersionsRouter);
router.use(coverLetterVersionsRouter);
router.use(applicationsRouter);
router.use(eventLogsRouter);
router.use(feedbackSignalsRouter);
router.use(aiModelConfigsRouter);

export default router;
