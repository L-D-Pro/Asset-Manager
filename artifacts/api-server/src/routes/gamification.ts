import { Router, type IRouter } from "express";
import { db, achievementsTable, userAchievementsTable, questsTable, userQuestsTable, xpLogTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import type { JobOpsRequest } from "../lib/http-types";
import { getGamificationStats, getOrCreateUserStats } from "../lib/gamification";
import { getNextActions } from "../lib/next-actions";

const router: IRouter = Router();

// GET /gamification/stats
router.get("/gamification/stats", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const stats = await getGamificationStats(userId);
  res.json(stats);
});

// GET /gamification/xp/history
router.get("/gamification/xp/history", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const items = await db
    .select()
    .from(xpLogTable)
    .where(eq(xpLogTable.userId, userId))
    .orderBy(desc(xpLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(xpLogTable)
    .where(eq(xpLogTable.userId, userId));

  res.json({ items, total });
});

// GET /gamification/achievements
router.get("/gamification/achievements", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;

  const all = await db.select().from(achievementsTable).orderBy(achievementsTable.id);
  const unlocked = await db
    .select()
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, userId));

  res.json({ achievements: all, unlocked });
});

// POST /gamification/achievements/:id/seen
router.post("/gamification/achievements/:id/seen", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const id = Number(req.params.id);

  await db
    .update(userAchievementsTable)
    .set({ seen: true })
    .where(and(eq(userAchievementsTable.userId, userId), eq(userAchievementsTable.achievementId, id)));

  res.json({ success: true });
});

// GET /gamification/quests
router.get("/gamification/quests", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;

  const active = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "active")));

  const completed = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "completed")))
    .orderBy(desc(userQuestsTable.completedAt))
    .limit(10);

  const available = await db.select().from(questsTable);

  res.json({ active, completed, available });
});

// POST /gamification/quests/:questId/accept
router.post("/gamification/quests/:questId/accept", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const questId = Number(req.params.questId);

  const existing = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.questId, questId), eq(userQuestsTable.status, "active")))
    .limit(1);

  if (existing.length > 0) {
    res.json({ quest: existing[0] });
    return;
  }

  const [row] = await db
    .insert(userQuestsTable)
    .values({ userId, questId })
    .returning();

  res.status(201).json({ quest: row });
});

// GET /gamification/next-actions
router.get("/gamification/next-actions", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const actions = await getNextActions(userId);
  res.json({ actions });
});

export default router;
