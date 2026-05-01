import { eq } from "drizzle-orm";
import { db, userOnboardingStateTable } from "@workspace/db";

export type OnboardingStep =
  | "resume"
  | "role_profile"
  | "first_job"
  | "wizard"
  | "application";

const ALL_STEPS: OnboardingStep[] = [
  "resume",
  "role_profile",
  "first_job",
  "wizard",
  "application",
];

/**
 * Get or create onboarding state for a user.
 */
export async function getOrCreateOnboardingState(userId: number) {
  const [existing] = await db
    .select()
    .from(userOnboardingStateTable)
    .where(eq(userOnboardingStateTable.userId, userId));

  if (existing) return existing;

  const [created] = await db
    .insert(userOnboardingStateTable)
    .values({ userId })
    .returning();

  return created;
}

/**
 * Mark the welcome modal as seen.
 */
export async function markWelcomeSeen(userId: number) {
  const [updated] = await db
    .update(userOnboardingStateTable)
    .set({ hasSeenWelcome: true, updatedAt: new Date() })
    .where(eq(userOnboardingStateTable.userId, userId))
    .returning();
  return updated;
}

/**
 * Mark a step as completed (idempotent).
 */
export async function completeStep(userId: number, step: OnboardingStep) {
  const state = await getOrCreateOnboardingState(userId);
  if (state.completedSteps.includes(step)) return state;

  const [updated] = await db
    .update(userOnboardingStateTable)
    .set({
      completedSteps: [...state.completedSteps, step],
      updatedAt: new Date(),
    })
    .where(eq(userOnboardingStateTable.userId, userId))
    .returning();

  return updated;
}

/**
 * Dismiss a contextual hint for a page.
 */
export async function dismissHint(userId: number, pagePath: string) {
  const state = await getOrCreateOnboardingState(userId);
  if (state.dismissedHints.includes(pagePath)) return state;

  const [updated] = await db
    .update(userOnboardingStateTable)
    .set({
      dismissedHints: [...state.dismissedHints, pagePath],
      updatedAt: new Date(),
    })
    .where(eq(userOnboardingStateTable.userId, userId))
    .returning();

  return updated;
}

/**
 * Calculate onboarding progress percentage (0-100).
 */
export function calculateProgress(state: {
  completedSteps: string[];
}): number {
  if (ALL_STEPS.length === 0) return 100;
  return Math.round(
    (state.completedSteps.length / ALL_STEPS.length) * 100,
  );
}

/**
 * Check if onboarding is fully complete.
 */
export function isOnboardingComplete(state: {
  completedSteps: string[];
}): boolean {
  return ALL_STEPS.every((step) => state.completedSteps.includes(step));
}
