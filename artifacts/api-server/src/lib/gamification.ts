import { eq, and, sql, desc, gte } from "drizzle-orm";
import { db, userStatsTable, xpLogTable, achievementsTable, userAchievementsTable, questsTable, userQuestsTable, streakLogTable } from "@workspace/db";

const XP_AWARDS: Record<string, number> = {
  job_apply: 50,
  wizard_complete: 100,
  resume_tailor: 75,
  cover_letter: 75,
  compare: 25,
  ai_visit: 10,
  daily_login: 15,
};

export function getXpForAction(actionType: string): number {
  return XP_AWARDS[actionType] ?? 5;
}

export function computeLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

export function xpToNextLevel(totalXp: number): number {
  const currentLevel = computeLevel(totalXp);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  return nextLevelXp - totalXp;
}

export async function getOrCreateUserStats(userId: number) {
  let stats = await db.query.userStatsTable.findFirst({
    where: eq(userStatsTable.userId, userId),
  });
  if (!stats) {
    const [row] = await db.insert(userStatsTable).values({ userId }).returning();
    stats = row;
  }
  return stats;
}

export async function recordStreakActivity(userId: number, xpEarned: number) {
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await db
    .select()
    .from(streakLogTable)
    .where(and(eq(streakLogTable.userId, userId), eq(streakLogTable.date, today)));

  if (existing) {
    await db
      .update(streakLogTable)
      .set({
        xpEarnedToday: existing.xpEarnedToday + xpEarned,
        actionsCount: existing.actionsCount + 1,
      })
      .where(eq(streakLogTable.id, existing.id));
  } else {
    await db.insert(streakLogTable).values({
      userId,
      date: today,
      xpEarnedToday: xpEarned,
      actionsCount: 1,
    });
  }

  // Recalculate streak
  const logs = await db
    .select()
    .from(streakLogTable)
    .where(eq(streakLogTable.userId, userId))
    .orderBy(desc(streakLogTable.date))
    .limit(31);

  let streak = 0;
  const expected = new Date(today);
  for (const log of logs) {
    const logDate = new Date(log.date).toISOString().slice(0, 10);
    const exp = expected.toISOString().slice(0, 10);
    if (logDate === exp) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }

  const stats = await getOrCreateUserStats(userId);
  await db
    .update(userStatsTable)
    .set({
      currentStreak: streak,
      longestStreak: Math.max(streak, stats.longestStreak),
      lastActivityDate: today,
    })
    .where(eq(userStatsTable.userId, userId));

  return streak;
}

export async function awardXp(userId: number, actionType: string, metadata: Record<string, unknown> = {}) {
  const xpAmount = getXpForAction(actionType);

  const [log] = await db
    .insert(xpLogTable)
    .values({ userId, actionType, xpAmount, metadata })
    .returning();

  const stats = await getOrCreateUserStats(userId);
  const newTotal = stats.totalXp + xpAmount;
  const oldLevel = computeLevel(stats.totalXp);
  const newLevel = computeLevel(newTotal);

  await db
    .update(userStatsTable)
    .set({ totalXp: newTotal, currentLevel: newLevel })
    .where(eq(userStatsTable.userId, userId));

  // Check achievements
  const unlocked = await checkAchievements(userId);

  // Update quests
  await updateQuestProgress(userId, actionType);

  await recordStreakActivity(userId, xpAmount);

  return {
    xpAwarded: xpAmount,
    totalXp: newTotal,
    currentLevel: newLevel,
    leveledUp: newLevel > oldLevel,
    newLevel: newLevel > oldLevel ? newLevel : undefined,
    xpToNext: xpToNextLevel(newTotal),
    unlockedAchievements: unlocked,
  };
}

async function checkAchievements(userId: number) {
  const stats = await getOrCreateUserStats(userId);

  // Count actions
  const [{ count: applyCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(xpLogTable)
    .where(and(eq(xpLogTable.userId, userId), eq(xpLogTable.actionType, "job_apply")));
  const [{ count: wizardCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(xpLogTable)
    .where(and(eq(xpLogTable.userId, userId), eq(xpLogTable.actionType, "wizard_complete")));
  const [{ count: questCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "completed")));

  const checks: Record<string, boolean> = {
    first_apply: Number(applyCount) >= 1,
    power_user: Number(applyCount) >= 10,
    hundred_club: stats.totalXp >= 1000,
    week_streak: stats.currentStreak >= 7,
    month_streak: stats.currentStreak >= 30,
    double_digit: Number(questCount) >= 10,
    wizard_master: Number(wizardCount) >= 5,
  };

  const unlocked: { id: number; slug: string; name: string }[] = [];

  const achievements = await db.select().from(achievementsTable);
  for (const a of achievements) {
    if (checks[a.slug]) {
      const existing = await db.query.userAchievementsTable.findFirst({
        where: and(
          eq(userAchievementsTable.userId, userId),
          eq(userAchievementsTable.achievementId, a.id)
        ),
      });
      if (!existing) {
        await db.insert(userAchievementsTable).values({ userId, achievementId: a.id });
        await db
          .update(userStatsTable)
          .set({ achievementsUnlocked: sql`${userStatsTable.achievementsUnlocked} + 1` })
          .where(eq(userStatsTable.userId, userId));
        // Award bonus XP
        await db
          .update(userStatsTable)
          .set({ totalXp: sql`${userStatsTable.totalXp} + ${a.xpReward}` })
          .where(eq(userStatsTable.userId, userId));
        unlocked.push({ id: a.id, slug: a.slug, name: a.name });
      }
    }
  }

  return unlocked;
}

async function updateQuestProgress(userId: number, actionType: string) {
  const activeQuests = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "active")));

  for (const uq of activeQuests) {
    const [quest] = await db
      .select()
      .from(questsTable)
      .where(eq(questsTable.id, uq.questId));
    if (!quest) continue;

    if (quest.criteriaType === "action_count") {
      const conditions = [];
      if (quest.slug.includes("apply")) {
        conditions.push(eq(xpLogTable.actionType, "job_apply"));
      } else if (quest.slug.includes("wizard")) {
        conditions.push(eq(xpLogTable.actionType, "wizard_complete"));
      } else if (quest.slug.includes("tailor") || quest.slug.includes("resume")) {
        conditions.push(eq(xpLogTable.actionType, "resume_tailor"));
      }

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(xpLogTable)
        .where(and(eq(xpLogTable.userId, userId), ...conditions));

      const newProgress = Math.min(Number(count), quest.criteriaValue);

      if (newProgress >= quest.criteriaValue) {
        await db
          .update(userQuestsTable)
          .set({ progress: newProgress, status: "completed", completedAt: new Date() })
          .where(eq(userQuestsTable.id, uq.id));
        // Award quest XP
        await awardXp(userId, `quest_${quest.slug}`, { questId: quest.id });
        await db
          .update(userStatsTable)
          .set({ questsCompleted: sql`${userStatsTable.questsCompleted} + 1` })
          .where(eq(userStatsTable.userId, userId));
      } else if (newProgress > uq.progress) {
        await db
          .update(userQuestsTable)
          .set({ progress: newProgress })
          .where(eq(userQuestsTable.id, uq.id));
      }
    }
  }
}

export async function getGamificationStats(userId: number) {
  const stats = await getOrCreateUserStats(userId);

  const activeQuests = await db
    .select({ userQuest: userQuestsTable, quest: questsTable })
    .from(userQuestsTable)
    .innerJoin(questsTable, eq(userQuestsTable.questId, questsTable.id))
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "active")));

  const unlocked = await db
    .select({ ua: userAchievementsTable, a: achievementsTable })
    .from(userAchievementsTable)
    .innerJoin(achievementsTable, eq(userAchievementsTable.achievementId, achievementsTable.id))
    .where(eq(userAchievementsTable.userId, userId))
    .orderBy(desc(userAchievementsTable.unlockedAt));

  return {
    totalXp: stats.totalXp,
    currentLevel: stats.currentLevel,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    xpToNextLevel: xpToNextLevel(stats.totalXp),
    questsCompleted: stats.questsCompleted,
    achievementsUnlocked: stats.achievementsUnlocked,
    activeQuests: activeQuests.map((aq) => ({
      id: aq.userQuest.id,
      questId: aq.quest.id,
      name: aq.quest.name,
      description: aq.quest.description,
      xpReward: aq.quest.xpReward,
      frequency: aq.quest.frequency,
      progress: aq.userQuest.progress,
      criteriaValue: aq.quest.criteriaValue,
      status: aq.userQuest.status,
      startedAt: aq.userQuest.startedAt,
    })),
    recentAchievements: unlocked.slice(0, 5).map((u) => ({
      id: u.ua.id,
      slug: u.a.slug,
      name: u.a.name,
      description: u.a.description,
      iconName: u.a.iconName,
      unlockedAt: u.ua.unlockedAt,
      seen: u.ua.seen,
    })),
  };
}
