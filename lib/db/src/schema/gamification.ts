import { pgTable, text, serial, timestamp, jsonb, integer, date, boolean, index, unique } from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin-users";

export const userStatsTable = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  totalXp: integer("total_xp").notNull().default(0),
  currentLevel: integer("current_level").notNull().default(1),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: date("last_activity_date"),
  questsCompleted: integer("quests_completed").notNull().default(0),
  achievementsUnlocked: integer("achievements_unlocked").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const xpLogTable = pgTable("xp_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  xpAmount: integer("xp_amount").notNull(),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("xp_log_user_idx").on(table.userId),
  index("xp_log_action_idx").on(table.actionType),
]);

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconName: text("icon_name").notNull().default("trophy"),
  xpReward: integer("xp_reward").notNull().default(0),
  criteriaType: text("criteria_type").notNull(),
  criteriaValue: integer("criteria_value").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAchievementsTable = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  achievementId: integer("achievement_id").notNull().references(() => achievementsTable.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  seen: boolean("seen").notNull().default(false),
}, (table) => [
  unique("user_achievement_uidx").on(table.userId, table.achievementId),
]);

export const questsTable = pgTable("quests", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull().default(25),
  frequency: text("frequency").notNull().default("one_time"),
  criteriaType: text("criteria_type").notNull(),
  criteriaValue: integer("criteria_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userQuestsTable = pgTable("user_quests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  questId: integer("quest_id").notNull().references(() => questsTable.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const streakLogTable = pgTable("streak_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  xpEarnedToday: integer("xp_earned_today").notNull().default(0),
  actionsCount: integer("actions_count").notNull().default(0),
}, (table) => [
  unique("streak_log_user_date_uidx").on(table.userId, table.date),
]);

export type UserStats = typeof userStatsTable.$inferSelect;
export type XpLog = typeof xpLogTable.$inferSelect;
export type Achievement = typeof achievementsTable.$inferSelect;
export type UserAchievement = typeof userAchievementsTable.$inferSelect;
export type Quest = typeof questsTable.$inferSelect;
export type UserQuest = typeof userQuestsTable.$inferSelect;
export type StreakLog = typeof streakLogTable.$inferSelect;
