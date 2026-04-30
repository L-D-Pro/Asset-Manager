import { db, userUsageLimitsTable, adminUsersTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

export async function checkUsageLimit(
  userId: number,
  increment: boolean = false,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const [limit] = await db
    .select()
    .from(userUsageLimitsTable)
    .where(eq(userUsageLimitsTable.userId, userId));

  if (!limit) {
    return { allowed: true, remaining: 999, limit: 999 };
  }

  let { weeklyLimit, weeklyUsed, periodStart } = limit;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (periodStart < weekAgo) {
    weeklyUsed = 0;
    periodStart = now;
    await db
      .update(userUsageLimitsTable)
      .set({ weeklyUsed: 0, periodStart: periodStart })
      .where(eq(userUsageLimitsTable.id, limit.id));
  }

  const allowed = weeklyUsed < weeklyLimit;
  const remaining = Math.max(0, weeklyLimit - weeklyUsed - (increment ? 1 : 0));

  if (increment && allowed) {
    await db
      .update(userUsageLimitsTable)
      .set({ weeklyUsed: weeklyUsed + 1, totalUsed: limit.totalUsed + 1 })
      .where(eq(userUsageLimitsTable.id, limit.id));
  }

  return { allowed, remaining, limit: weeklyLimit };
}
