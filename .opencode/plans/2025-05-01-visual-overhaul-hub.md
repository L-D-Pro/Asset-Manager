# Visual Overhaul — Hub Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the core navigation, dashboard, onboarding experience, and landing page with a cohesive gamified visual system that answers "What should I do next?" for new users.

**Architecture:** Build a gamified CSS token layer on top of the existing UI Shell theme system, restructure the sidebar for progressive disclosure with a setup progress widget, add a server-persisted onboarding state machine, and redesign the dashboard as a command center with dynamic "Next Actions."

**Tech Stack:** React 19.1.0, Tailwind CSS, Framer Motion, Radix UI, Drizzle ORM, Express 5, React Query, PostgreSQL

---

## File Structure Map

### New Files
- `lib/db/src/schema/user-onboarding.ts` — Onboarding state table
- `artifacts/api-server/src/lib/onboarding.ts` — Onboarding service (state machine, progress calc)
- `artifacts/api-server/src/lib/next-actions.ts` — Next action suggestion engine
- `artifacts/api-server/src/routes/onboarding.ts` — Onboarding API routes
- `artifacts/dashboard/src/components/onboarding/setup-progress.tsx` — Sidebar setup progress widget
- `artifacts/dashboard/src/components/onboarding/welcome-modal.tsx` — First-login welcome overlay
- `artifacts/dashboard/src/components/onboarding/contextual-hint.tsx` — First-time page hints
- `artifacts/dashboard/src/components/dashboard/next-actions.tsx` — Dashboard next actions cards
- `artifacts/dashboard/src/hooks/use-onboarding.ts` — React Query hooks for onboarding API

### Modified Files
- `artifacts/dashboard/src/index.css` — Add gamified utility tokens
- `artifacts/dashboard/src/components/layout/sidebar.tsx` — Restructure nav, add setup widget
- `artifacts/dashboard/src/pages/dashboard.tsx` — Add next actions, reorganize layout
- `artifacts/dashboard/src/pages/landing/index.tsx` — Fix hardcoded colors, add gamification teasers
- `artifacts/dashboard/src/App.tsx` — Add WelcomeModal
- `artifacts/dashboard/src/components/layout/main-layout.tsx` — Add ContextualHint
- `lib/db/src/schema/index.ts` — Export new table
- `lib/db/src/schema/relations.ts` — Add onboarding relations
- `lib/db/runtime-compat.sql` — Add onboarding table DDL
- `artifacts/api-server/src/routes/index.ts` — Register onboarding router
- `artifacts/api-server/src/routes/gamification.ts` — Add /next-actions endpoint

---

## Phase 1: Foundation

### Task 1: Add gamified CSS utility tokens

**Files:**
- Modify: `artifacts/dashboard/src/index.css`

Add a new `@layer utilities` block at the end of the file with gamified design tokens that derive from the existing CSS variable system.

- [ ] **Step 1: Open `artifacts/dashboard/src/index.css` and locate the end of the file**

- [ ] **Step 2: Append the gamified utilities block**

```css
@layer utilities {
  /* Primary brand gradient - adapts to any UI Shell theme */
  .gamify-gradient-primary {
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8) 50%, hsl(var(--accent) / 0.6));
  }

  /* Warm accent gradient for cards and badges */
  .gamify-gradient-warm {
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
  }

  /* Subtle gradient for backgrounds and surfaces */
  .gamify-gradient-subtle {
    background: linear-gradient(150deg, hsl(var(--card)), hsl(var(--card)) 70%, hsl(var(--primary) / 0.08));
  }

  /* Glow shadow for interactive elements */
  .gamify-shadow {
    box-shadow: 0 4px 20px -4px hsl(var(--primary) / 0.25);
  }

  .gamify-shadow-lg {
    box-shadow: 0 8px 40px -8px hsl(var(--primary) / 0.3);
  }

  /* Ambient glow for featured elements */
  .gamify-glow {
    box-shadow: 0 0 40px -10px hsl(var(--primary) / 0.35);
  }

  /* Chunky border radius (Duolingo-style) */
  .gamify-radius-chunky {
    border-radius: 16px;
  }

  /* Pill radius for buttons and badges */
  .gamify-radius-pill {
    border-radius: 9999px;
  }

  /* Animated gradient border effect */
  .gamify-gradient-border {
    position: relative;
  }

  .gamify-gradient-border::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 2px;
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  /* Floating animation for featured elements */
  .gamify-float {
    animation: gamify-float 3s ease-in-out infinite;
  }

  @keyframes gamify-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  /* Pulse glow for notifications/new items */
  .gamify-pulse-glow {
    animation: gamify-pulse-glow 2s ease-in-out infinite;
  }

  @keyframes gamify-pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
    50% { box-shadow: 0 0 20px 4px hsl(var(--primary) / 0.2); }
  }
}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git add artifacts/dashboard/src/index.css
git commit -m "feat: add gamified CSS utility tokens"
```

---

### Task 2: Create user onboarding state DB schema

**Files:**
- Create: `lib/db/src/schema/user-onboarding.ts`
- Modify: `lib/db/src/schema/index.ts`
- Modify: `lib/db/src/schema/relations.ts`
- Modify: `lib/db/runtime-compat.sql`

- [ ] **Step 1: Create `lib/db/src/schema/user-onboarding.ts`**

```ts
import { pgTable, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminUsersTable } from "./admin-users";

/**
 * User onboarding state — tracks progress through the getting-started flow.
 *
 * Each user has exactly one onboarding state row. Steps are stored as an array
 * of completed step IDs. Hints dismissed by the user are tracked per page path.
 */
export const userOnboardingStateTable = pgTable("user_onboarding_state", {
  /** FK to admin_users — one-to-one relationship. */
  userId: integer("user_id")
    .primaryKey()
    .references(() => adminUsersTable.id, { onDelete: "cascade" }),

  /** Whether the user has seen the welcome modal. */
  hasSeenWelcome: boolean("has_seen_welcome").notNull().default(false),

  /** Array of completed step IDs: ["resume", "role_profile", "first_job", "wizard", "application"] */
  completedSteps: text("completed_steps").array().notNull().default([]),

  /** Array of page paths where hints have been dismissed. */
  dismissedHints: text("dismissed_hints").array().notNull().default([]),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserOnboardingStateSchema = createInsertSchema(
  userOnboardingStateTable,
).omit({
  createdAt: true,
  updatedAt: true,
});

export type UserOnboardingState = typeof userOnboardingStateTable.$inferSelect;
export type InsertUserOnboardingState = z.infer<
  typeof insertUserOnboardingStateSchema
>;
```

- [ ] **Step 2: Add barrel export to `lib/db/src/schema/index.ts`**

Add to the end of the file:
```ts
export * from "./user-onboarding";
```

- [ ] **Step 3: Add relation to `lib/db/src/schema/relations.ts`**

```ts
import { userOnboardingStateTable } from "./user-onboarding";

export const adminUsersRelations = relations(adminUsersTable, ({ one }) => ({
  onboardingState: one(userOnboardingStateTable, {
    fields: [adminUsersTable.id],
    references: [userOnboardingStateTable.userId],
  }),
}));
```

- [ ] **Step 4: Add DDL to `lib/db/runtime-compat.sql`**

Append to the end of the file:
```sql
-- User onboarding state table
CREATE TABLE IF NOT EXISTS user_onboarding_state (
    user_id INTEGER PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
    has_seen_welcome BOOLEAN NOT NULL DEFAULT false,
    completed_steps TEXT[] NOT NULL DEFAULT '{}',
    dismissed_hints TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_onboarding_state_user_id_idx ON user_onboarding_state(user_id);
```

- [ ] **Step 5: Run typecheck**

Run: `corepack pnpm --filter @workspace/db run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/schema/user-onboarding.ts lib/db/src/schema/index.ts lib/db/src/schema/relations.ts lib/db/runtime-compat.sql
git commit -m "feat: add user onboarding state schema"
```

---

### Task 3: Apply DB migration

**Files:** None (runtime compat script)

- [ ] **Step 1: Load DATABASE_URL and run compat**

```powershell
$env:DATABASE_URL = (Select-String -Path .env -Pattern "^DATABASE_URL=(.*)" | ForEach-Object { $_.Matches.Groups[1].Value })
corepack pnpm --filter @workspace/db run compat
```

Expected: Script completes without errors, `user_onboarding_state` table created.

- [ ] **Step 2: Verify table exists**

```powershell
$env:DATABASE_URL = (Select-String -Path .env -Pattern "^DATABASE_URL=(.*)" | ForEach-Object { $_.Matches.Groups[1].Value })
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1 FROM user_onboarding_state LIMIT 1').then(() => { console.log('Table exists'); pool.end(); }).catch(e => { console.error(e.message); pool.end(); });
"
```

Expected: `Table exists`

---

### Task 4: Create onboarding service

**Files:**
- Create: `artifacts/api-server/src/lib/onboarding.ts`

- [ ] **Step 1: Create the service file**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm --filter @workspace/api-server run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add artifacts/api-server/src/lib/onboarding.ts
git commit -m "feat: add onboarding service"
```

---

### Task 5: Create onboarding API routes

**Files:**
- Create: `artifacts/api-server/src/routes/onboarding.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

- [ ] **Step 1: Create the router**

```ts
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userOnboardingStateTable } from "@workspace/db";
import type { JobOpsRequest } from "../lib/http-types";
import {
  getOrCreateOnboardingState,
  markWelcomeSeen,
  completeStep,
  dismissHint,
  calculateProgress,
  isOnboardingComplete,
  type OnboardingStep,
} from "../lib/onboarding";

const router: IRouter = Router();

// GET /api/onboarding/state — get current onboarding state
router.get("/onboarding/state", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const state = await getOrCreateOnboardingState(userId);
  res.json({
    ...state,
    progress: calculateProgress(state),
    isComplete: isOnboardingComplete(state),
  });
});

// POST /api/onboarding/welcome-seen — mark welcome as seen
router.post("/onboarding/welcome-seen", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const state = await markWelcomeSeen(userId);
  res.json({
    ...state,
    progress: calculateProgress(state),
    isComplete: isOnboardingComplete(state),
  });
});

// POST /api/onboarding/complete-step — mark a step completed
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

// POST /api/onboarding/dismiss-hint — dismiss a contextual hint
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
```

- [ ] **Step 2: Register router in `artifacts/api-server/src/routes/index.ts`**

Add to the PROTECTED section (after `requireAuth`):
```ts
import onboardingRouter from "./onboarding";
// ... other imports

router.use(requireAuth);
// ... existing routers
router.use(onboardingRouter);
```

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm --filter @workspace/api-server run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/routes/onboarding.ts artifacts/api-server/src/routes/index.ts
git commit -m "feat: add onboarding API routes"
```

---

### Task 6: Create next-actions engine

**Files:**
- Create: `artifacts/api-server/src/lib/next-actions.ts`
- Modify: `artifacts/api-server/src/routes/gamification.ts`

- [ ] **Step 1: Create the engine**

```ts
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  baseResumeVersionsTable,
  roleProfilesTable,
  jobsTable,
  applicationsTable,
  wizardSessionsTable,
} from "@workspace/db/schema";

export interface NextAction {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  category: "setup" | "action" | "review";
}

/**
 * Generate personalized next actions based on the user's current state.
 * Returns top 3 actions ordered by priority.
 */
export async function getNextActions(userId: number): Promise<NextAction[]> {
  const actions: NextAction[] = [];

  // Check 1: Base resume
  const [resume] = await db
    .select()
    .from(baseResumeVersionsTable)
    .limit(1);
  if (!resume) {
    actions.push({
      id: "add_resume",
      title: "Add your base resume",
      description: "Upload or paste your resume so AI can tailor it for jobs",
      href: "/base-resume",
      priority: 1,
      category: "setup",
    });
  }

  // Check 2: Role profile
  const [profile] = await db
    .select()
    .from(roleProfilesTable)
    .limit(1);
  if (!profile) {
    actions.push({
      id: "create_profile",
      title: "Create a role profile",
      description: "Define your target role for better job matching and scoring",
      href: "/role-profiles",
      priority: 2,
      category: "setup",
    });
  }

  // Check 3: Jobs ingested
  const jobCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable);
  if (jobCount[0].count === 0) {
    actions.push({
      id: "ingest_job",
      title: "Ingest your first job",
      description: "Paste a job URL or description to start tracking opportunities",
      href: "/jobs",
      priority: 3,
      category: "setup",
    });
  }

  // Check 4: Applications tracked
  const appCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(applicationsTable);
  if (appCount[0].count === 0 && jobCount[0].count > 0) {
    actions.push({
      id: "track_application",
      title: "Track an application",
      description: "Log an application to monitor your pipeline progress",
      href: "/applications",
      priority: 4,
      category: "action",
    });
  }

  // Check 5: Try the wizard (if jobs exist but no wizard sessions)
  const wizardCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(wizardSessionsTable);
  if (wizardCount[0].count === 0 && jobCount[0].count > 0) {
    actions.push({
      id: "try_wizard",
      title: "Try the Apply Wizard",
      description: "Let AI guide you through tailoring and applying",
      href: "/apply-wizard",
      priority: 5,
      category: "action",
    });
  }

  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
```

- [ ] **Step 2: Add endpoint to gamification router**

In `artifacts/api-server/src/routes/gamification.ts`, add:
```ts
import { getNextActions } from "../lib/next-actions";

// Add after existing routes:
router.get("/gamification/next-actions", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const actions = await getNextActions(userId);
  res.json({ actions });
});
```

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm --filter @workspace/api-server run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/lib/next-actions.ts artifacts/api-server/src/routes/gamification.ts
git commit -m "feat: add next-actions engine and endpoint"
```

---

## Phase 2: Dashboard Components

### Task 7: Create useOnboarding React Query hooks

**Files:**
- Create: `artifacts/dashboard/src/hooks/use-onboarding.ts`

- [ ] **Step 1: Create the hooks file**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const ONBOARDING_KEY = ["onboarding"];

export interface OnboardingState {
  userId: number;
  hasSeenWelcome: boolean;
  completedSteps: string[];
  dismissedHints: string[];
  progress: number;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useOnboardingState() {
  return useQuery<OnboardingState>({
    queryKey: ONBOARDING_KEY,
    queryFn: async () => {
      const res = await api.get("/onboarding/state");
      return res.data;
    },
  });
}

export function useMarkWelcomeSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post("/onboarding/welcome-seen");
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
    },
  });
}

export function useCompleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (step: string) => {
      const res = await api.post("/onboarding/complete-step", { step });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
    },
  });
}

export function useDismissHint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pagePath: string) => {
      const res = await api.post("/onboarding/dismiss-hint", { pagePath });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
    },
  });
}
```

- [ ] **Step 2: Verify `api` import path is correct**

Check that `artifacts/dashboard/src/lib/api.ts` or similar exists and exports an axios-like instance.
If not, use the fetch pattern from existing hooks.

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add artifacts/dashboard/src/hooks/use-onboarding.ts
git commit -m "feat: add onboarding React Query hooks"
```

---

### Task 8: Create SetupProgress sidebar widget

**Files:**
- Create: `artifacts/dashboard/src/components/onboarding/setup-progress.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useOnboardingState } from "@/hooks/use-onboarding";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "resume", label: "Add your resume" },
  { id: "role_profile", label: "Create role profile" },
  { id: "first_job", label: "Ingest a job" },
  { id: "wizard", label: "Try the wizard" },
  { id: "application", label: "Track application" },
];

export function SetupProgress() {
  const { data: state } = useOnboardingState();
  if (!state) return null;
  if (state.isComplete) return null;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-sidebar-foreground">
          Getting Started
        </span>
        <span className="text-xs font-medium text-sidebar-primary">
          {state.progress}%
        </span>
      </div>
      <Progress
        value={state.progress}
        className="h-1.5"
      />
      <div className="mt-2 space-y-1">
        {STEPS.map((step) => {
          const isDone = state.completedSteps.includes(step.id);
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-1.5 text-[10px]",
                isDone
                  ? "text-sidebar-foreground/60"
                  : "text-sidebar-foreground/40",
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
              <span className={cn(isDone && "line-through")}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/components/onboarding/setup-progress.tsx
git commit -m "feat: add sidebar setup progress widget"
```

---

### Task 9: Create WelcomeModal component

**Files:**
- Create: `artifacts/dashboard/src/components/onboarding/welcome-modal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";
import { useOnboardingState, useMarkWelcomeSeen } from "@/hooks/use-onboarding";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GradientButton } from "@/components/gamification/GradientButton";
import { motion } from "framer-motion";
import { Sparkles, Target, FileText, Rocket } from "lucide-react";

const WELCOME_STEPS = [
  {
    icon: FileText,
    title: "Build Your Foundation",
    description: "Add your base resume and create role profiles for AI-powered matching.",
  },
  {
    icon: Target,
    title: "Track Opportunities",
    description: "Ingest jobs, get AI-powered scores, and manage your pipeline.",
  },
  {
    icon: Rocket,
    title: "Apply with Confidence",
    description: "Use the Apply Wizard for guided resume tailoring and cover letters.",
  },
];

export function WelcomeModal() {
  const { data: state } = useOnboardingState();
  const markSeen = useMarkWelcomeSeen();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state && !state.hasSeenWelcome) {
      setOpen(true);
    }
  }, [state]);

  const handleClose = () => {
    setOpen(false);
    markSeen.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gamify-radius-chunky max-w-lg border-2 border-primary/20 gamify-shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" />
            Welcome to Job Ops
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-muted-foreground">
            Let&apos;s get you set up for job search success. Here&apos;s what you can do:
          </p>
          <div className="space-y-3">
            {WELCOME_STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="flex items-start gap-3 rounded-xl bg-muted/50 p-3"
              >
                <div className="gamify-gradient-warm flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <step.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
          <GradientButton
            onClick={handleClose}
            className="w-full"
            size="lg"
          >
            Let&apos;s Go!
          </GradientButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/components/onboarding/welcome-modal.tsx
git commit -m "feat: add welcome modal for first-time users"
```

---

### Task 10: Create ContextualHint component

**Files:**
- Create: `artifacts/dashboard/src/components/onboarding/contextual-hint.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useOnboardingState, useDismissHint } from "@/hooks/use-onboarding";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

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
          className={cn(
            "relative mx-6 mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 gamify-shadow",
          )}
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
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/components/onboarding/contextual-hint.tsx
git commit -m "feat: add contextual hints for first-time page visits"
```

---

### Task 11: Create NextActions dashboard component

**Files:**
- Create: `artifacts/dashboard/src/components/dashboard/next-actions.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Target, ClipboardList, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NextAction {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  category: "setup" | "action" | "review";
}

const CATEGORY_ICONS = {
  setup: FileText,
  action: Target,
  review: ClipboardList,
};

const CATEGORY_COLORS = {
  setup: "from-amber-500/20 to-orange-500/10",
  action: "from-primary/20 to-accent/10",
  review: "from-emerald-500/20 to-teal-500/10",
};

export function NextActions() {
  const { data, isLoading } = useQuery<{ actions: NextAction[] }>({
    queryKey: ["next-actions"],
    queryFn: async () => {
      const res = await api.get("/gamification/next-actions");
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  const actions = data?.actions ?? [];

  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-6 text-center">
        <Wand2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <h3 className="font-semibold">You&apos;re all caught up!</h3>
        <p className="text-sm text-muted-foreground">
          Check out Trends or ingest a new job to keep momentum.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">What&apos;s Next?</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {actions.map((action, i) => {
          const Icon = CATEGORY_ICONS[action.category];
          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={action.href}
                className={cn(
                  "group flex h-full flex-col rounded-2xl border border-border bg-gradient-to-br p-5 transition-all hover:gamify-shadow",
                  CATEGORY_COLORS[action.category],
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <h3 className="font-semibold">{action.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {action.description}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/components/dashboard/next-actions.tsx
git commit -m "feat: add next-actions dashboard component"
```

---

## Phase 3: Layout Integration

### Task 12: Redesign sidebar structure

**Files:**
- Modify: `artifacts/dashboard/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add SetupProgress import and integrate**

Add to imports:
```tsx
import { SetupProgress } from "@/components/onboarding/setup-progress";
```

Add `<SetupProgress />` inside the `<SidebarContent>` component, after the featured cards and before the collapsible groups.

- [ ] **Step 2: Restructure nav groups**

The current sidebar has collapsible groups for Jobs, Documents, AI Tools, Freelance, Settings.

Change to:
- **Primary** (always visible, no collapse): Jobs Pipeline, Applications, Base Resume, Apply Wizard
- **Documents** (collapsible, collapsed by default): Claims Ledger, Resumes Queue, Cover Letters Queue
- **AI Tools** (collapsible, collapsed by default): AI Review, AI Metrics, AI Config, AI Learning
- **Freelance** (collapsible, collapsed by default): Freelance Assist
- **Settings** (always visible, minimal): Account, Help & Tips

Implementation: Create separate arrays for primary vs secondary nav items. Render primary items directly (no Collapsible wrapper), render secondary items inside Collapsible with defaultOpen={false}.

For the primary items, use the same styling as existing nav items (left border accent, rounded-r-lg) but without the group header.

- [ ] **Step 3: Remove Feedback Signals from AI Tools group**

Remove the Feedback Signals nav item. It will be merged into Applications page later.

- [ ] **Step 4: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add artifacts/dashboard/src/components/layout/sidebar.tsx
git commit -m "feat: restructure sidebar with primary/secondary nav and setup progress"
```

---

### Task 13: Redesign dashboard layout

**Files:**
- Modify: `artifacts/dashboard/src/pages/dashboard.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { NextActions } from "@/components/dashboard/next-actions";
```

- [ ] **Step 2: Reorganize layout**

The current dashboard has:
1. Gamification strip (XP, streak, achievements)
2. Stats cards
3. Inspirational quote

New layout:
1. Gamification strip (keep as-is)
2. **NextActions** section (new)
3. Stats cards (keep but restyle with gamified tokens)
4. Inspirational quote (keep at bottom)

Add `<NextActions />` after the gamification strip.

- [ ] **Step 3: Restyle stats cards with gamified tokens**

Update the stats card containers to use:
- `gamify-gradient-subtle` for background
- `gamify-radius-chunky` for border radius
- `gamify-shadow` for hover state

Replace hardcoded color classes (`text-indigo-600`, `bg-teal-500/10`, etc.) with semantic tokens (`text-primary`, `bg-primary/10`, etc.).

- [ ] **Step 4: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add artifacts/dashboard/src/pages/dashboard.tsx
git commit -m "feat: redesign dashboard with next actions and gamified styling"
```

---

### Task 14: Integrate onboarding into App shell

**Files:**
- Modify: `artifacts/dashboard/src/App.tsx`
- Modify: `artifacts/dashboard/src/components/layout/main-layout.tsx`

- [ ] **Step 1: Add WelcomeModal to App**

Add import:
```tsx
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
```

Add `<WelcomeModal />` inside the router/providers tree, right before the closing `</BrowserRouter>`.

- [ ] **Step 2: Add ContextualHint to main layout**

Modify `artifacts/dashboard/src/components/layout/main-layout.tsx` to include `<ContextualHint />` inside the main content area, above the children.

Add import:
```tsx
import { ContextualHint } from "@/components/onboarding/contextual-hint";
```

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add artifacts/dashboard/src/App.tsx artifacts/dashboard/src/components/layout/main-layout.tsx
git commit -m "feat: integrate welcome modal and contextual hints into app shell"
```

---

## Phase 4: Landing Page

### Task 15: Fix landing page hardcoded colors

**Files:**
- Modify: `artifacts/dashboard/src/pages/landing/index.tsx`
- Modify: `artifacts/dashboard/src/index.css`

- [ ] **Step 1: Replace hero gradient**

Find: `from-indigo-600 via-indigo-500 to-violet-500`
Replace with: `from-primary via-primary/80 to-accent`

- [ ] **Step 2: Replace blue text tones**

Find: `text-blue-100` → Replace with: `text-primary-foreground/80`
Find: `text-blue-200` → Replace with: `text-primary-foreground/70`
Find: `text-indigo-600` → Replace with: `text-primary`
Find: `bg-blue-50` → Replace with: `bg-primary/10`

- [ ] **Step 3: Add success/warning tokens to index.css**

If `--success` or `--warning` tokens don't exist, add them to `:root` and `.dark`:

```css
:root {
  --success: 142 76% 36%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 100%;
}

.dark {
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 100%;
}
```

Also add to `@theme inline`:
```css
--color-success: hsl(var(--success));
--color-success-foreground: hsl(var(--success-foreground));
--color-warning: hsl(var(--warning));
--color-warning-foreground: hsl(var(--warning-foreground));
```

- [ ] **Step 4: Replace success/warning/error colors in landing**

Find: `text-emerald-500` / `text-emerald-100` / `bg-emerald-100` → Replace with: `text-success` / `bg-success/10`
Find: `text-amber-400` / `fill-amber-400` / `text-amber-500` / `fill-amber-500` → Replace with: `text-warning` / `fill-warning`
Find: `text-red-400` → Replace with: `text-destructive`
Find: `bg-red-400/80`, `bg-amber-400/80`, `bg-emerald-400/80` → Replace with: `bg-destructive/80`, `bg-warning/80`, `bg-success/80`

- [ ] **Step 5: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add artifacts/dashboard/src/pages/landing/index.tsx artifacts/dashboard/src/index.css
git commit -m "fix: replace landing page hardcoded colors with theme tokens"
```

---

### Task 16: Add gamification teaser to landing page

**Files:**
- Modify: `artifacts/dashboard/src/pages/landing/index.tsx`

- [ ] **Step 1: Add a gamification teaser section**

After the "HowItWorks" section and before "Comparison", add a new section that teases the gamification features:

- Badge with "Level Up Your Search"
- 3 cards showing: XP system, streak tracking, achievements
- Use gamified tokens (gamify-gradient-warm, gamify-shadow, gamify-radius-chunky)

This should be ~50 lines of JSX. Use the existing section pattern (motion.div with fadeInUp).

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/pages/landing/index.tsx
git commit -m "feat: add gamification teaser section to landing page"
```

---

## Phase 5: Verification & Polish

### Task 17: Full workspace typecheck

**Files:** All

- [ ] **Step 1: Run full typecheck**

```bash
corepack pnpm run typecheck
```

Expected: All 5 packages PASS with 0 errors.

- [ ] **Step 2: Verify no Mantine imports remain**

```bash
grep -r "@mantine" artifacts/dashboard/src/ || echo "No Mantine imports found"
```

Expected: "No Mantine imports found"

- [ ] **Step 3: Verify no hardcoded indigo/teal colors in landing**

```bash
grep -E "(indigo|teal|violet|blue-100|blue-200)" artifacts/dashboard/src/pages/landing/index.tsx || echo "Clean"
```

Expected: "Clean"

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: verify full workspace typecheck and clean imports"
```

---

## Spoke Phases (Outline)

These will be implemented in follow-up plans after the Hub is validated:

### Phase 6: Core Workflows
- Reskin Jobs Pipeline page with gamified tokens
- Reskin Job Detail page (tabs, AI actions)
- Reskin Apply Wizard (chunky buttons, progress rings)
- Merge Feedback Signals into Applications page as "Outcomes" tab

### Phase 7: Document Workflows
- Reskin Base Resume editor
- Reskin Resume Versions queue
- Reskin Cover Letters queue
- Reskin Claims Ledger

### Phase 8: AI Tools & Admin
- Reskin AI Review, AI Metrics, AI Config, AI Learning
- Reskin Account, Help, Settings pages
- Reskin Admin pages (User Management, Invite Codes, etc.)

### Phase 9: Final Polish
- Consistent empty states across all pages
- Loading skeletons with gamified styling
- Animation polish (staggered entrances, micro-interactions)
- Accessibility audit (reduced motion, focus states, contrast)

---

## Self-Review Checklist

- [ ] Spec coverage: All hub requirements met (tokens, sidebar, onboarding, dashboard, landing)
- [ ] No placeholders: Every task has complete code
- [ ] Type consistency: OnboardingStep type used consistently across service and API
- [ ] File paths: All paths verified against existing codebase structure
- [ ] DB safety: runtime-compat.sql uses IF NOT EXISTS
- [ ] API safety: All endpoints validate input with safeParse or manual checks
- [ ] Frontend safety: Hooks handle loading/error states
