# Job Ops MVP Public Launch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition Job Ops from internal-only to an invite-only public pilot with email verification, usage limits, legal pages, and viral growth features.

**Architecture:** Extend the existing `admin_users` table (which already serves as the universal user table) with pilot/verification fields. Add `invite_codes` and `user_usage_limits` tables. Integrate Resend for transactional emails. Build public-facing registration, legal pages, and growth features while keeping the existing auth/session infrastructure intact.

**Tech Stack:** Node.js 24.x, pnpm, Express 5, Drizzle ORM, PostgreSQL, React + Vite, TanStack Query, Resend API, Zod validation

---

## File Map

| File | Responsibility |
|------|---------------|
| `lib/db/src/schema/admin-users.ts` | Extended user schema with email verification, pilot status, usage limits |
| `lib/db/src/schema/invite-codes.ts` | **New** — Invite code table (code, maxUses, usedCount, expiresAt, createdBy) |
| `lib/db/src/schema/user-usage-limits.ts` | **New** — Usage tracking (userId, monthlyLimit, monthlyUsed, totalUsed) |
| `lib/db/src/schema/index.ts` | Export new schemas |
| `lib/db/runtime-compat.sql` | Manual migration for new tables |
| `lib/api-spec/openapi.yaml` | New endpoints: invite codes, registration, email verification, password reset, usage limits |
| `lib/api-zod/src/generated/*` | Codegen output |
| `lib/api-client-react/src/generated/*` | Codegen output |
| `artifacts/api-server/src/lib/resend-service.ts` | **New** — Resend email wrapper with branded templates |
| `artifacts/api-server/src/lib/usage-limit.ts` | **New** — Usage limit middleware and helpers |
| `artifacts/api-server/src/routes/auth.ts` | Extended with register, verify-email, resend-verification, forgot-password, reset-password |
| `artifacts/api-server/src/routes/invite-codes.ts` | **New** — Admin invite code CRUD |
| `artifacts/api-server/src/routes/usage-limits.ts` | **New** — Admin usage limit management |
| `artifacts/api-server/src/routes/index.ts` | Register new routers |
| `artifacts/dashboard/src/pages/register/index.tsx` | **New** — Public registration with invite code + Pilot Terms |
| `artifacts/dashboard/src/pages/verify-email/index.tsx` | **New** — Email verification landing page |
| `artifacts/dashboard/src/pages/reset-password/index.tsx` | **New** — Password reset request + confirm |
| `artifacts/dashboard/src/pages/terms/index.tsx` | **New** — Terms of Service |
| `artifacts/dashboard/src/pages/privacy/index.tsx` | **New** — Privacy Policy |
| `artifacts/dashboard/src/pages/admin/invite-codes.tsx` | **New** — Admin invite code management |
| `artifacts/dashboard/src/pages/admin/usage-limits.tsx` | **New** — Admin usage monitoring |
| `artifacts/dashboard/src/pages/landing/index.tsx` | Updated pricing, CTA to /register, real testimonials or disclaimers |
| `artifacts/dashboard/src/App.tsx` | New public routes |
| `artifacts/dashboard/src/context/auth.tsx` | Extended with register, verify, resetPassword functions |
| `artifacts/dashboard/src/components/pilot-terms-modal.tsx` | **New** — Reusable Pilot Terms acceptance modal |
| `artifacts/dashboard/src/components/feedback-widget.tsx` | **New** — Floating feedback button |
| `artifacts/dashboard/src/components/community-activity.tsx` | **New** — Anonymized activity feed |
| `artifacts/dashboard/index.html` | Updated meta tags, OG tags |
| `docs/PUBLIC_GUIDE.md` | **New** — Sanitized user-facing guide |
| `docs/ADMIN_GUIDE.md` | **New** — Internal admin documentation |

---

## Phase 1: Auth & Registration Upgrade

### Task 1: Extend User Schema

**Files:**
- Modify: `lib/db/src/schema/admin-users.ts`
- Modify: `lib/db/src/schema/index.ts`
- Create: `lib/db/src/schema/invite-codes.ts`
- Create: `lib/db/src/schema/user-usage-limits.ts`
- Modify: `lib/db/runtime-compat.sql`

- [ ] **Step 1: Add fields to admin_users table**

Add to `admin_users` schema:
- `emailVerified: boolean("email_verified").notNull().default(false)`
- `emailConfirmationToken: text("email_confirmation_token")`
- `emailConfirmationExpires: timestamp("email_confirmation_expires")`
- `passwordResetToken: text("password_reset_token")`
- `passwordResetExpires: timestamp("password_reset_expires")`
- `isPilotParticipant: boolean("is_pilot_participant").notNull().default(false)`
- `pilotTermsAcceptedAt: timestamp("pilot_terms_accepted_at")`
- `pilotEnrollmentType: text("pilot_enrollment_type")` // "invite" | "waitlist"
- `utmSource: text("utm_source")`
- `utmMedium: text("utm_medium")`
- `utmCampaign: text("utm_campaign")`
- `isActive: boolean("is_active").notNull().default(true)`

- [ ] **Step 2: Create invite_codes table**

```typescript
export const inviteCodesTable = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdByAdminId: integer("created_by_admin_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Create user_usage_limits table**

```typescript
export const userUsageLimitsTable = pgTable("user_usage_limits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }).unique(),
  monthlyLimit: integer("monthly_limit").notNull().default(50),
  monthlyUsed: integer("monthly_used").notNull().default(0),
  totalUsed: integer("total_used").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: Register schemas in index.ts**

- [ ] **Step 5: Add CREATE TABLE statements to runtime-compat.sql**

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/schema/
git commit -m "feat(auth): extend user schema with email verification, pilot fields; add invite_codes and user_usage_limits tables"
```

### Task 2: Create Resend Email Service

**Files:**
- Create: `artifacts/api-server/src/lib/resend-service.ts`
- Modify: `artifacts/api-server/package.json`
- Modify: `.env` (user does this)

- [ ] **Step 1: Install resend dependency**

```bash
corepack pnpm --filter @workspace/api-server add resend
```

- [ ] **Step 2: Create Resend service with branded templates**

Service should support:
- `sendEmailVerification(email, token, firstName?)` — Link to `/verify-email/:token`
- `sendWelcomeEmail(email, firstName?)`
- `sendPasswordReset(email, token, firstName?)` — Link to `/reset-password?token=...`
- `sendWaitlistConfirmation(email)`
- `sendFeedbackAcknowledgment(email)`

Template wrapper: branded HTML with inline CSS, app name "Job Ops", primary color.

- [ ] **Step 3: Add RESEND_API_KEY and FROM_EMAIL to .env**

User action: Add to `.env`:
```
RESEND_API_KEY=sk_...
FROM_EMAIL=noreply@jobops.ldpro.com
```

- [ ] **Step 4: Commit**

### Task 3: Update OpenAPI Spec for Auth & Invite Endpoints

**Files:**
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Add invite-codes tag and endpoints**

- `GET /api/invite-codes` — List all (admin)
- `POST /api/invite-codes` — Generate new code (admin)
- `DELETE /api/invite-codes/:id` — Revoke code (admin)
- `POST /api/invite-codes/validate` — Public validate endpoint

- [ ] **Step 2: Add auth endpoints**

- `POST /api/auth/register` — Public registration with invite code
- `GET /api/auth/verify-email/:token` — Email verification
- `POST /api/auth/resend-verification` — Resend verification email
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Confirm password reset

- [ ] **Step 3: Add usage-limit endpoints**

- `GET /api/usage-limits` — Admin list all user limits
- `PATCH /api/usage-limits/:userId` — Admin update limit
- `GET /api/usage-limits/me` — Current user's usage

- [ ] **Step 4: Run codegen**

```bash
corepack pnpm --filter @workspace/api-spec run codegen
```

- [ ] **Step 5: Commit**

### Task 4: Implement Backend Auth Routes

**Files:**
- Modify: `artifacts/api-server/src/routes/auth.ts`
- Modify: `artifacts/api-server/src/routes/users.ts`

- [ ] **Step 1: Add registration endpoint**

`POST /api/auth/register`
- Validate invite code (exists, active, not expired, usedCount < maxUses)
- Validate username (unique, lowercase alphanumeric + underscore)
- Validate email (unique, valid format)
- Validate password (min 12 chars)
- Hash password with bcrypt (cost 12)
- Generate email confirmation token (32-byte hex, 24h expiry)
- Create user with `emailVerified: false`, `isPilotParticipant: true`, `pilotEnrollmentType: "invite"`, `pilotTermsAcceptedAt: now`
- Increment invite code `usedCount`
- Create `user_usage_limits` row with default monthly limit
- Send verification email via Resend
- Return 201 with user id (no auto-login)

- [ ] **Step 2: Add email verification endpoint**

`GET /api/auth/verify-email/:token`
- Lookup user by token
- Check token not expired
- Set `emailVerified: true`, clear token fields
- Send welcome email
- Return success message

- [ ] **Step 3: Add resend verification endpoint**

`POST /api/auth/resend-verification`
- Rate limit: 3 per email per hour
- Always return 200 (anti-enumeration)
- Generate new token, send email

- [ ] **Step 4: Add password reset endpoints**

`POST /api/auth/forgot-password`
- Rate limit: 3 per email per 15 min
- Always return 200
- Generate token (1h expiry), send email

`POST /api/auth/reset-password`
- Validate token and new password (min 12)
- Hash new password, clear token

- [ ] **Step 5: Update login endpoint**
- Block login if `emailVerified === false` (return 403 with message)
- Block login if `isActive === false`

- [ ] **Step 6: Commit**

### Task 5: Implement Invite Code Backend

**Files:**
- Create: `artifacts/api-server/src/routes/invite-codes.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

- [ ] **Step 1: Create invite code routes**

`GET /api/invite-codes` (admin only)
- Return all codes with usage stats

`POST /api/invite-codes` (admin only)
- Body: `{ label?: string, maxUses?: number, expiresInDays?: number }`
- Generate code: `JOBOPS-${random 6 chars}`
- Default: maxUses=50, expiresInDays=30

`DELETE /api/invite-codes/:id` (admin only)
- Soft delete (set isActive=false)

`POST /api/invite-codes/validate` (public)
- Body: `{ code: string }`
- Return `{ valid: boolean, message?: string }`

- [ ] **Step 2: Register router**

- [ ] **Step 3: Commit**

### Task 6: Implement Usage Limit Backend

**Files:**
- Create: `artifacts/api-server/src/routes/usage-limits.ts`
- Create: `artifacts/api-server/src/lib/usage-limit.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

- [ ] **Step 1: Create usage limit middleware**

```typescript
export async function checkUsageLimit(userId: number, increment: boolean = false): Promise<{ allowed: boolean; remaining: number; limit: number }>
```
- Check if user exists in `user_usage_limits`
- If periodStart is from previous month, reset `monthlyUsed` to 0, update `periodStart`
- If `increment`, increment `monthlyUsed` and `totalUsed`
- Return remaining count

- [ ] **Step 2: Apply middleware to AI endpoints**

Wrap these routes with usage limit check:
- `POST /api/jobs/:id/parse`
- `POST /api/jobs/:id/tailor`
- `POST /api/jobs/:id/draft-cover-letter`
- `POST /api/jobs/:id/compare/*`
- `POST /api/jobs/:id/research`
- `POST /api/ai-learning/*`

If limit exceeded, return 429 with `{ error: "Monthly AI request limit reached. Contact support." }`

- [ ] **Step 3: Create admin routes**

`GET /api/usage-limits` — List all users with limits
`PATCH /api/usage-limits/:userId` — Update monthly limit
`GET /api/usage-limits/me` — Current user's stats

- [ ] **Step 4: Commit**

### Task 7: Build Registration UI

**Files:**
- Create: `artifacts/dashboard/src/pages/register/index.tsx`
- Modify: `artifacts/dashboard/src/App.tsx`

- [ ] **Step 1: Create registration page**

Fields:
- Username (lowercase, alphanumeric + underscore)
- Email
- Password (min 12, strength indicator)
- Confirm Password
- Invite Code (required, validated on blur)
- Pilot Terms acceptance checkbox

Invite code validation:
- On blur, call `POST /api/invite-codes/validate`
- Show green checkmark or red error
- If invalid, disable submit

Pilot Terms:
- Show modal with terms text (placeholder for now)
- Checkbox: "I agree to the Pilot Terms and understand this is a beta program"

Submit:
- Call `POST /api/auth/register`
- On success: show "Check your email to verify your account"
- On error: show error message

- [ ] **Step 2: Add route to App.tsx**

`/register` — public route, redirect to `/dashboard` if already authenticated

- [ ] **Step 3: Commit**

### Task 8: Build Email Verification & Password Reset UI

**Files:**
- Create: `artifacts/dashboard/src/pages/verify-email/index.tsx`
- Create: `artifacts/dashboard/src/pages/reset-password/index.tsx`
- Modify: `artifacts/dashboard/src/App.tsx`

- [ ] **Step 1: Create verify-email page**

`/verify-email/:token`
- On mount: call `GET /api/auth/verify-email/:token`
- Show success or error state
- Link to login page

- [ ] **Step 2: Create reset-password page**

Two modes:
1. Request mode (`/reset-password`):
   - Email input
   - Submit calls `POST /api/auth/forgot-password`
   - Always show "If an account exists, check your email"

2. Confirm mode (`/reset-password?token=...`):
   - New password + confirm
   - Submit calls `POST /api/auth/reset-password`
   - On success: redirect to login

- [ ] **Step 3: Add routes**

- [ ] **Step 4: Commit**

### Task 9: Update Auth Context

**Files:**
- Modify: `artifacts/dashboard/src/context/auth.tsx`

- [ ] **Step 1: Add register function**

```typescript
register: (data: { username: string; email: string; password: string; inviteCode: string }) => Promise<void>
```

- [ ] **Step 2: Add resendVerification function**

```typescript
resendVerification: (email: string) => Promise<void>
```

- [ ] **Step 3: Add requestPasswordReset function**

```typescript
requestPasswordReset: (email: string) => Promise<void>
```

- [ ] **Step 4: Commit**

---

## Phase 2: Admin Dashboard & Usage Controls

### Task 10: Admin Invite Code Management

**Files:**
- Create: `artifacts/dashboard/src/pages/admin/invite-codes.tsx`
- Modify: `artifacts/dashboard/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create invite codes admin page**

Table showing:
- Code label
- Code string
- Max uses / Used count
- Expires at
- Status (active/inactive)
- Actions: Revoke

Generate form:
- Label (optional)
- Max uses (default 50)
- Expires in days (default 30)
- Submit generates code, shows it in a toast/alert (copyable)

- [ ] **Step 2: Add to sidebar**

New nav item: "Invite Codes" under admin section

- [ ] **Step 3: Commit**

### Task 11: Admin Usage Monitoring

**Files:**
- Create: `artifacts/dashboard/src/pages/admin/usage-limits.tsx`
- Modify: `artifacts/dashboard/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create usage limits admin page**

Table showing all users:
- Username
- Email
- Monthly limit
- Monthly used
- Remaining
- Total used
- Period start
- Actions: Edit limit

Edit modal:
- New monthly limit input
- Submit calls `PATCH /api/usage-limits/:userId`

- [ ] **Step 2: Add to sidebar**

New nav item: "Usage Limits" under admin section

- [ ] **Step 3: Commit**

---

## Phase 3: UI & Content Revamp

### Task 12: Landing Page Updates

**Files:**
- Modify: `artifacts/dashboard/src/pages/landing/index.tsx`
- Modify: `artifacts/dashboard/index.html`

- [ ] **Step 1: Update pricing cards**

Replace fake pricing with pilot offer:
- "Free for the duration of the test phase + 3 months of Basic Tier"
- CTA: "Join Pilot" → links to `/register`
- Add disclaimer: "Limited spots available. Invite code required."

- [ ] **Step 2: Replace or disclaim fake stats/testimonials**

Either:
- Remove fake testimonials and stats, OR
- Add clear "Example data" disclaimers

- [ ] **Step 3: Update CTAs**

All "Get Started" / "Sign In" buttons should route appropriately:
- Unauthenticated: "Join Pilot" → `/register`
- Authenticated: "Go to Dashboard" → `/dashboard`

- [ ] **Step 4: Update meta tags**

In `index.html`:
- `<title>Job Ops — AI-Powered Job Application Platform</title>`
- Add meta description
- Add OG tags (title, description, image, url)
- Add Twitter Card tags

- [ ] **Step 5: Commit**

### Task 13: Pilot Terms Component

**Files:**
- Create: `artifacts/dashboard/src/components/pilot-terms-modal.tsx`

- [ ] **Step 1: Create modal component**

Content:
- Title: "Job Ops Pilot Program Terms"
- Body sections:
  - "Beta Software" — This is pre-release software. Bugs and downtime may occur.
  - "Data & Privacy" — We collect job application data to improve AI suggestions. See Privacy Policy.
  - "Feedback" — Pilot participants agree to provide periodic feedback.
  - "Usage Limits" — AI requests are limited per month. See your account for current limits.
  - "Termination" — We reserve the right to terminate pilot access at any time.
- Footer: Checkbox "I have read and agree to the Pilot Terms" + "Agree and Continue" button

- [ ] **Step 2: Integrate into registration page**

- [ ] **Step 3: Commit**

### Task 14: Legal Pages

**Files:**
- Create: `artifacts/dashboard/src/pages/terms/index.tsx`
- Create: `artifacts/dashboard/src/pages/privacy/index.tsx`
- Modify: `artifacts/dashboard/src/App.tsx`
- Modify: `artifacts/dashboard/src/pages/landing/index.tsx` (footer links)
- Modify: `artifacts/dashboard/src/components/layout/main-layout.tsx` (footer links)

- [ ] **Step 1: Create Terms of Service page**

Public route `/terms-of-service`
Structure:
- Header: "Terms of Service"
- Sections:
  1. Acceptance of Terms
  2. Description of Service
  3. User Accounts
  4. Acceptable Use
  5. Intellectual Property
  6. Limitation of Liability
  7. Termination
  8. Changes to Terms
  9. Contact Information

- [ ] **Step 2: Create Privacy Policy page**

Public route `/privacy-policy`
Structure:
- Header: "Privacy Policy"
- Sections:
  1. Information We Collect
  2. How We Use Information
  3. Data Storage and Security
  4. Cookies and Tracking
  5. Third-Party Services
  6. Your Rights
  7. Children's Privacy
  8. Changes to Policy
  9. Contact

- [ ] **Step 3: Update footer links**

Replace non-clickable `<span>` elements with actual `<Link>` components pointing to `/terms-of-service` and `/privacy-policy`.

Locations:
- Landing page footer
- Main layout footer
- Login page footer

- [ ] **Step 4: Commit**

---

## Phase 4: Documentation Split

### Task 15: Public Guide

**Files:**
- Create: `docs/PUBLIC_GUIDE.md`

- [ ] **Step 1: Create sanitized public guide**

Based on `docs/USER_GUIDE.md`, remove:
- All installation instructions
- All technical architecture details
- Database schema references
- API endpoint details
- Environment variable references
- Deployment instructions
- Internal code paths

Keep:
- Feature overviews
- How-to guides for end users
- Screenshots (if any)
- Troubleshooting for common user issues
- FAQ

- [ ] **Step 2: Add link in dashboard**

Add "Help" link in sidebar or navbar pointing to `/guide` (the existing in-app guide should be sanitized too, or the public guide should be a separate page).

**Decision needed:** Should the existing `/guide` route be the public guide, or should we create a new `/help` route?

- [ ] **Step 3: Commit**

### Task 16: Admin Guide

**Files:**
- Create: `docs/ADMIN_GUIDE.md`
- Create: `artifacts/dashboard/src/pages/admin/docs.tsx`
- Modify: `artifacts/dashboard/src/App.tsx`

- [ ] **Step 1: Create internal admin guide**

Move sensitive content from `docs/USER_GUIDE.md`:
- Architecture diagrams
- Database schema details
- API documentation
- Environment setup
- Deployment procedures
- Security considerations
- Internal runbooks

- [ ] **Step 2: Create admin docs page**

Protected route `/admin/docs`
- Render markdown content (use a markdown renderer component)
- Only accessible to role=admin

- [ ] **Step 3: Add to sidebar**

Nav item: "Admin Docs" under admin section

- [ ] **Step 4: Commit**

---

## Phase 5: Growth & Feedback Engine

### Task 17: Waitlist Fallback

**Files:**
- Create: `artifacts/api-server/src/routes/waitlist.ts`
- Create: `lib/db/src/schema/waitlist.ts`
- Modify: `lib/db/src/schema/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Modify: `artifacts/dashboard/src/pages/register/index.tsx`

- [ ] **Step 1: Create waitlist schema**

```typescript
export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  linkedinUrl: text("linkedin_url"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Create waitlist API routes**

`POST /api/waitlist` — Public, accepts email, name, LinkedIn URL, UTM params
- Validate email format
- Send confirmation email via Resend
- Return 201

`GET /api/waitlist` — Admin only, list all entries

- [ ] **Step 3: Update registration page**

If invite code validation fails with "Code fully used":
- Show "This invite code has reached its limit."
- Show "Join the Waitlist" form (email + name + LinkedIn URL)
- Submit calls `POST /api/waitlist`
- On success: "You're on the waitlist! We'll email you when spots open."

- [ ] **Step 4: Commit**

### Task 18: Feedback Widget

**Files:**
- Create: `artifacts/dashboard/src/components/feedback-widget.tsx`
- Create: `artifacts/api-server/src/routes/feedback.ts`
- Create: `lib/db/src/schema/feedback.ts`

- [ ] **Step 1: Create feedback schema**

```typescript
export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  type: text("type").notNull(), // "bug" | "feature" | "general"
  message: text("message").notNull(),
  pageUrl: text("page_url"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Create feedback API route**

`POST /api/feedback` — Authenticated
- Save to DB
- Send notification email to admin via Resend
- Return 201

- [ ] **Step 3: Create feedback widget component**

Floating button (bottom-right corner):
- Icon: MessageCircle or similar
- On click: opens modal
- Form: Type (Bug / Feature / General), Message, optional screenshot
- Submit calls `POST /api/feedback`
- Show success toast

- [ ] **Step 4: Add widget to MainLayout**

Render on all authenticated pages.

- [ ] **Step 5: Commit**

### Task 19: UTM Tracking

**Files:**
- Modify: `artifacts/dashboard/src/App.tsx`
- Modify: `artifacts/dashboard/src/pages/register/index.tsx`

- [ ] **Step 1: Capture UTM params on app load**

In `App.tsx` useEffect:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const utm = {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
  };
  if (utm.source || utm.medium || utm.campaign) {
    localStorage.setItem('jobops_utm', JSON.stringify(utm));
  }
}, []);
```

- [ ] **Step 2: Include UTM in registration payload**

Read from localStorage, include in `POST /api/auth/register` body.
Server stores in `admin_users.utmSource`, `utmMedium`, `utmCampaign`.

- [ ] **Step 3: Create UTM report endpoint**

`GET /api/admin/utm-stats` (admin only)
- Aggregate registrations by utm_source, utm_medium, utm_campaign
- Return counts per campaign

- [ ] **Step 4: Add UTM stats to admin dashboard**

Simple table or bar chart showing conversion by source.

- [ ] **Step 5: Commit**

### Task 20: Community Activity Feed

**Files:**
- Create: `artifacts/dashboard/src/components/community-activity.tsx`
- Modify: `artifacts/dashboard/src/pages/dashboard/index.tsx`

- [ ] **Step 1: Create activity aggregation endpoint**

`GET /api/activity-feed` — Public (no auth required)
Returns anonymized stats:
```typescript
{
  jobsAppliedLastHour: number,
  jobsParsedToday: number,
  resumesGeneratedThisWeek: number,
  activeUsersToday: number,
}
```

Query from existing tables:
- `applicationsTable` for jobs applied
- `jobsTable` (status="applied") for parsed jobs
- `resumeVersionsTable` for resumes generated
- `eventLogsTable` or session table for active users

- [ ] **Step 2: Create CommunityActivity component**

Small card/grid showing:
- "12 jobs applied to in the last hour"
- "47 resumes tailored today"
- "3 new pilot users joined this week"

Animated numbers (count up on mount).
Auto-refresh every 60 seconds.

- [ ] **Step 3: Add to landing page and dashboard**

Landing page: below hero section
Dashboard: top of page or in sidebar

- [ ] **Step 4: Commit**

---

## Verification Checklist

Before calling this complete, verify:

- [ ] Typecheck passes: `corepack pnpm run typecheck`
- [ ] All new routes are documented in OpenAPI spec
- [ ] Codegen has been run and generated files are up to date
- [ ] Database migration applied: `$env:DATABASE_URL = ...; pnpm --filter @workspace/db run compat`
- [ ] Resend API key configured in `.env`
- [ ] Email templates render correctly (send test emails)
- [ ] Invite code generation works from admin panel
- [ ] Registration with valid invite code succeeds
- [ ] Registration with invalid/expired code shows waitlist fallback
- [ ] Email verification link works
- [ ] Password reset flow works end-to-end
- [ ] Usage limits are enforced on AI endpoints
- [ ] Admin can view and edit usage limits
- [ ] Legal pages are accessible without auth
- [ ] Landing page CTAs route to `/register`
- [ ] Feedback widget submits and sends email
- [ ] UTM params are captured and stored
- [ ] Community activity feed shows real data

---

## Open Questions / User Decisions Needed

1. **Resend API Key**: Do you have a Resend account and API key? If not, sign up at resend.com and add `RESEND_API_KEY` to `.env`.

2. **Legal Content**: You mentioned having ToS and Privacy Policy from another app. Please paste them when ready, or I can generate standard templates.

3. **Reference Repo Access**: To port exact logic from LDProPortfolioStudio, I need read access. Options:
   - Add me (`opencode`) as a collaborator on https://github.com/L-D-Pro/LDProPortfolioStudio
   - Or zip and share the relevant files (auth.ts, storage.ts, schema.ts)
   - Or paste key code snippets

4. **Usage Limit Default**: What should the default monthly AI request limit be for new pilot users? (Recommendation: 50)

5. **Invite Code Prefix**: Should invite codes use a prefix like `JOBOPS-` or `LINKEDIN-`? (Recommendation: `JOBOPS-` for main, `LINKEDIN-` for LinkedIn-specific)

6. **Email Domain**: What FROM_EMAIL should Resend use? (Recommendation: `noreply@jobops.ldpro.com` or `hello@jobops.ldpro.com`)

---

## Execution Options

**Plan complete and saved to `.opencode/plans/2026-04-28-job-ops-public-launch.md`.**

This is a large plan (20 tasks across 5 phases). Two execution approaches:

**1. Phased Implementation (Recommended)** — I implement one phase at a time, verify, then move to the next. This keeps each chunk manageable and allows early testing.

**2. Full Sprint** — Implement all phases in one session. Risk of context overflow and harder to debug.

**Which approach would you prefer?** Also, please provide answers to the open questions above so I can start building.
