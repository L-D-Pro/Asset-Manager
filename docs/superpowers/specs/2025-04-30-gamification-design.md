# Gamification Engine & Visual Overhaul Design Spec

**Date:** 2025-04-30
**Status:** Approved, awaiting implementation plan
**Previous context:** Mantine migration stalled (React 19 incompatibilities), UI Shell theme system working

---

## 1. Problem Statement

The Job Ops app is functional but visually uninspiring. A Mantine component migration was started to modernize the UI but stalled due to React 19 incompatibilities (`useEffectEvent` crashes). The UI Shell theme system provides 41 color themes, but the components using them look flat and corporate. The user wants a **Duolingo-style gamified SaaS** aesthetic that is vibrant, pretty, and drives feature engagement through game mechanics.

## 2. Architecture Decision

### Remove Mantine, Keep Radix, Build Custom Gamified Components

**Old (broken):** Mantine components (partial migration) + Radix primitives + Custom
**New:** Custom gamified components + Radix primitives + Higo theme CSS variables

| Layer | Status | Rationale |
|-------|--------|-----------|
| **Mantine** | REMOVED | React 19 crashes, corporate aesthetic, not needed |
| **Radix primitives** | KEPT | Stable with React 19, unstyled (we apply gamified skins) |
| **Higo themes (UI Shell)** | PRESERVED | 41 themes, CSS variables on `:root`, backend-persisted |
| **Gamified components** | NEW | Built from scratch, consume Higo CSS variables |
| **Gamification engine** | NEW | XP, streaks, achievements, quests backend |

### Stack remains:
- React 19.1.0 + Vite (dashboard)
- Express 5 (API server)
- Drizzle ORM + PostgreSQL (DB)
- TypeScript 5.9 strict

## 3. Database Schema

### 3.1 `user_stats` — one row per user

```sql
CREATE TABLE IF NOT EXISTS user_stats (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  quests_completed integer NOT NULL DEFAULT 0,
  achievements_unlocked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.2 `xp_log` — immutable XP transactions

```sql
CREATE TABLE IF NOT EXISTS xp_log (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'job_apply' | 'wizard_complete' | 'ai_visit' | 'resume_tailor' | 'cover_letter' | 'compare' | 'daily_login'
  xp_amount integer NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.3 `achievements` — master list

```sql
CREATE TABLE IF NOT EXISTS achievements (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon_name text NOT NULL DEFAULT 'trophy',
  xp_reward integer NOT NULL DEFAULT 0,
  criteria_type text NOT NULL, -- 'action_count' | 'streak_length' | 'xp_total' | 'level_reached'
  criteria_value integer NOT NULL,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.4 `user_achievements` — unlock state

```sql
CREATE TABLE IF NOT EXISTS user_achievements (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  achievement_id integer NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  seen boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, achievement_id)
);
```

### 3.5 `quests` — master list

```sql
CREATE TABLE IF NOT EXISTS quests (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  xp_reward integer NOT NULL DEFAULT 25,
  frequency text NOT NULL DEFAULT 'one_time', -- 'daily' | 'weekly' | 'one_time'
  criteria_type text NOT NULL, -- 'action_count'
  criteria_value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.6 `user_quests` — active/completed quests per user

```sql
CREATE TABLE IF NOT EXISTS user_quests (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  quest_id integer NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'expired'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
```

### 3.7 `streak_log` — daily activity record

```sql
CREATE TABLE IF NOT EXISTS streak_log (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  date date NOT NULL,
  xp_earned_today integer NOT NULL DEFAULT 0,
  actions_count integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);
```

### Design choices:
- XP is **append-only** (`xp_log`) for audit trail and replay capability
- Achievements can be **hidden** (`is_hidden`) for surprise unlocks
- Quests have **expiration** (daily/weekly rotation managed by `frequency` field)
- Streak is derived from `streak_log` + `user_stats.last_activity_date`
- `current_level` is computed: `floor(sqrt(total_xp / 100))` + 1

## 4. API Endpoints

All under `/gamification/` prefix. All require authentication (session or JWT).

### 4.1 Stats

```
GET /gamification/stats
Response: { totalXp, currentLevel, currentStreak, longestStreak, xpToNextLevel,
            totalQuestsCompleted, totalAchievementsUnlocked, activeQuests }
```

### 4.2 XP

```
GET /gamification/xp/history?limit=20&offset=0
Response: { items: XpLogEntry[], total: number }

POST /gamification/xp/award  (internal — called by route handlers, not directly by client)
Body: { userId, actionType, xpAmount, metadata? }
Response: { totalXp, xpAwarded, leveledUp, newLevel?, unlockedAchievements?[] }
```

### 4.3 Achievements

```
GET /gamification/achievements
Response: { achievements: Achievement[], unlocked: UserAchievement[] }

POST /gamification/achievements/:id/seen
Body: {}
Response: { success: true }
```

### 4.4 Quests

```
GET /gamification/quests
Response: { active: UserQuest[], available: Quest[], completed: UserQuest[] }

POST /gamification/quests/:questId/accept
Body: {}
Response: { quest: UserQuest }
```

## 5. Gamified Component Library

All components consume CSS variables from the Higo theme system (`--color-primary`, `--color-secondary`, `--color-bg`, etc.), making them responsive to the admin's theme selection.

### 5.1 `GradientButton`

Chunky rounded button with gradient background and scale animation on hover.
- Border radius: 16px (pill on smaller sizes)
- Background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`
- Hover: `scale(1.03)`, subtle glow
- Variants: primary (gradient), secondary (outlined), ghost (transparent), quest (sparkle icon)
- Sizes: sm, md, lg

### 5.2 `ProgressRing`

SVG circular progress indicator with animated fill.
- Glowing stroke using theme accent color
- Center text showing fraction (e.g., "3/5")
- Animated fill on value change
- Configurable size and stroke width

### 5.3 `XPCard`

Card displaying user's XP and level status.
- Level badge (icon + number) at top
- XP progress bar showing current vs. next level
- "N XP to Level 5" caption
- Subtle gradient or geometric background pattern
- XP animation when new XP awarded (+50 XP pop-in)

### 5.4 `Badge`

Small pill component for achievements and status.
- Icon + text layout
- Gradient border
- "New!" shimmer animation on unseen achievements
- Variants: gold (rare), silver (uncommon), bronze (common)

### 5.5 `StreakFlame`

Animated flame icon with streak count.
- Fire emoji or SVG flame icon
- Count displayed inside or beside
- Flame intensity/size scales with streak length (1-3 days: small, 4-6: medium, 7+: large with glow)
- Subtle pulse animation for current-day streak

### 5.6 `QuestCard`

Card component for individual quests.
- Quest name, description
- Progress bar with fraction (e.g., 3/5)
- XP reward badge
- Time remaining (for daily/weekly quests)
- Color coding: active (primary gradient), completed (green gradient with check), expired (muted)

### 5.7 `AchievementToast`

Slide-in toast notification when unlocking an achievement.
- Slide in from top-right
- Achievement icon + name + description
- Confetti-style particle animation (CSS only, no library)
- Auto-dismiss after 5 seconds
- Stack multiple toasts

### 5.8 Radix Skin Wrappers

Existing Radix primitives (Dialog, Popover, Tooltip, Select, DropdownMenu) receive styled wrapper components that:
- Use theme CSS variables for backgrounds, borders, shadows
- Add gradient accents on interactive elements
- Consistent 12px border radius
- Subtle backdrop blur on overlays

## 6. Dashboard Hub Redesign

The main dashboard becomes the gamified "home base" for the user.

### Layout

```
┌──────────────────────────────────────────────────┐
│ [XP Bar] Level 4 · 2,450 / 3,000 XP             │  ← Sticky header
├──────────────────────────────────────────────────┤
│ [Streak Flames 7 days] [Longest: 12 days]       │
├─────────────────────┬────────────────────────────┤
│ Daily Quests        │ Recent Achievements        │
│ ┌─────────────────┐ │ Trophy Wall (grid)         │
│ │ Apply to 3 jobs  │ │ 🏅 First Apply             │
│ │ ████████░░ 2/3   │ │ 🎯 Sharpshooter            │
│ │ +50 XP           │ │ ⚡ Speed Demon              │
│ │ Expires in 12h   │ │ 🔥 Week Streak             │
│ ├─────────────────┤ │                            │
│ │ Tailor 2 resumes │ │                            │
│ │ ██████████ 2/2 ✓ │ │                            │
│ │ +75 XP           │ │                            │
│ └─────────────────┘ │                            │
├─────────────────────┴────────────────────────────┤
│ Stats Cards (animated counters)                  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐        │
│ │  12  │ │   5  │ │   3  │ │     2    │        │
│ │ Jobs │ │ Apps │ │Resume│ │Cover Ltr │        │
│ └──────┘ └──────┘ └──────┘ └──────────┘        │
├──────────────────────────────────────────────────┤
│ AI Learning Insight (existing widget, polished)  │
├──────────────────────────────────────────────────┤
│ Daily Inspiration Quote                          │
└──────────────────────────────────────────────────┘
```

### Behaviors
- XP bar animates on load (width transition)
- Streak flame pulses when on a streak >= 3 days
- "New!" badge on unseen achievements in the trophy wall
- Quest progress updates in real-time (poll or SSE)
- Stats counters count up from 0 on page load (CSS animation or JS increment)
- Confetti-like particle burst when achievement unlocks during session
- Empty states show encouraging copy (e.g., "No achievements yet — go apply to your first job!")

## 7. Feature Integration (XP Awards)

| Action | XP Award | Trigger |
|--------|----------|---------|
| Apply to a job | +50 | `POST /jobs/:id/apply` success |
| Complete apply wizard | +100 | Wizard completion endpoint |
| Tailor a resume | +75 | `POST /jobs/:id/compare/promote-resume` success |
| Draft a cover letter | +75 | `POST /jobs/:id/compare/promote-cover-letter` success |
| Run a model comparison | +25 | `POST /jobs/:id/compare/*` success |
| Visit AI Learning page | +10 | First visit of the day |
| Daily login | +15 | First authenticated request of the day |
| Complete a quest | +25-200 | Quest completion (varies by quest) |

### Achievement definitions (initial set)

| Slug | Name | Description | Criterion | XP |
|------|------|-------------|-----------|------|
| `first_apply` | First Steps | Apply to your first job | action_count: applies=1 | 50 |
| `power_user` | Power User | Apply to 10 jobs | action_count: applies=10 | 200 |
| `hundred_club` | The Hundred Club | Earn 1000 total XP | xp_total: 1000 | 250 |
| `week_streak` | Week Warrior | Maintain a 7-day streak | streak_length: 7 | 150 |
| `month_streak` | Unstoppable | Maintain a 30-day streak | streak_length: 30 | 500 |
| `double_digit` | Double Digits | Complete 10 quests | action_count: quests=10 | 100 |
| `wizard_master` | Wizard Master | Complete the apply wizard 5 times | action_count: wizard=5 | 200 |
| `speed_demon` | Speed Demon | Apply to a job within 5 min of creating it | time_gap: <5min | 100 |
| `collector` | Collector | Have 5 active jobs | active_jobs: 5 | 50 |

## 8. Phase Plan

### Phase 0: Cleanup (Remove Mantine)

- Remove all Mantine package imports from `package.json`
- Replace Mantine components with Radix primitives or custom components
- Verify no broken imports or missing components
- Update `Migration_summary.md` to reflect new architecture
- Verify UI Shell theme system still operational

### Phase 1: Gamification Engine (Backend)

- Create Drizzle schema for all 7 tables in `lib/db/src/schema/gamification.ts`
- Create seed file for initial achievements and quests
- Implement gamification service (`lib/gamification.ts` in api-server)
  - Core logic: XP award, level calculation, streak tracking, achievement checks, quest rotation
- Create API routes (`artifacts/api-server/src/routes/gamification.ts`)
- Add XP award hooks to existing route handlers
- Write runtime-compat.sql migration

### Phase 2: Gamified Visual System (Frontend)

- Build component library in `artifacts/dashboard/src/components/gamification/`:
  - `GradientButton.tsx`, `ProgressRing.tsx`, `XPCard.tsx`, `Badge.tsx`, `StreakFlame.tsx`, `QuestCard.tsx`, `AchievementToast.tsx`
- Create styled Radix wrappers in `artifacts/dashboard/src/components/ui/` (overlaying existing imports)
- Create API client hooks using `@workspace/api-client-react`
- Wire components to consume Higo CSS variables

### Phase 3: Dashboard Hub

- Redesign `artifacts/dashboard/src/pages/dashboard/index.tsx`
- Integrate XPCard, StreakFlame, QuestCard, Badge, AchievementToast
- Add animated stat counters
- Polish trophy wall and quest panel layouts

### Phase 4: Feature Integration

- Wire XP awards into existing route handlers
- Add quest progression tracking to relevant pages
- Implement achievement unlock detection
- End-to-end testing of all XP flows
- Polish animations and edge cases

## 9. Risk & Constraints

| Risk | Mitigation |
|------|------------|
| Radix primitives are unstyled — we must style them fully | Build styled wrapper components with Higo theme vars |
| XP system might feel gimmicky | Keep XP rewards modest, focus on visual polish, no notifications overload |
| Achievement criteria can be complex | Start simple (count-based), extend later |
| Streak logic must handle timezone edge cases | Use UTC dates, derive "local day" from user preference or server time |
| Quest rotation needs cron-like scheduling | Use daily/weekly quest refresh on API call, no server cron needed initially |
| React 19 must be kept (pnpm workspace constraint) | Radix is proven stable with React 19; no Mantine = no crashes |

## 10. Success Criteria

1. App loads without Mantine errors (no `useEffectEvent` crashes)
2. User can earn XP by performing actions (apply, wizard, compare, etc.)
3. Dashboard shows XP bar, streak, quests, and achievements visually
4. Theme switching via UI Shell applies correctly to gamified components
5. Achievements unlock automatically with toast notification
6. Streak count increments on daily activity
7. All typecheck passes across workspace

---

*This spec supersedes the previous Mantine migration plan. The Migration_summary.md will be updated to reflect the hybrid Radix + gamified architecture.*
