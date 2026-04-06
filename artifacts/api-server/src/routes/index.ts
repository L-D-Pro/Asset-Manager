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
