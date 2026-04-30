# UX Overhaul — Design Spec

> **Date:** 2026-04-29 | **Status:** Approved | **Topic:** Navbar organization + modern UI refresh + missing features

## Overview

Transform the Job Ops dashboard from a flat, developer-oriented tool into a modern,
user-friendly career platform. Five changes:

1. **Navbar reorganized** into 5 collapsible groups (from 20 flat items)
2. **Bold energetic visual refresh** (gradients, glass-morphism, vibrant accents)
3. **Daily inspiration widget** on dashboard
4. **Resources page** (free education + mental health links)
5. **Guide split** into user-facing Help & Tips and admin-only Admin Docs

## 1. Navbar Redesign

### Current state
20 flat items in a `SidebarMenu`. No hierarchy. Confusing names like "Feedback Signals", "Role Profiles", "AI Review" for non-technical users.

### New design: 5 collapsible groups

Each group has a header label and a chevron toggle. One group can be expanded at a time (accordion behavior). Groups:

| Group | Icon (lucide) | Items |
|-------|--------------|-------|
| **Jobs** | Briefcase | Pipeline, Applications, Assisted Apply, Trends |
| **Documents** | FileText | Base Resume, Claims Ledger, Resumes Queue, Cover Letters Queue |
| **AI Tools** | Brain | AI Review, AI Metrics, AI Config, AI Learning |
| **Freelance** | Handshake | Freelance Copilot, Role Profiles, Feedback Signals |
| **Settings** | Settings | Account, Guide (Help & Tips), Admin section (conditional) |

**Special cases:**
- "Wizard" stays as standalone top item (prominent, only when `VITE_ENABLE_APPLY_WIZARD=true`)
- "Admin" section (User Management, Invite Codes, Usage Limits, Admin Docs) only visible to admin users
- Active page highlighted within its group
- Groups use compact spacing (py-1) vs current py-2 spacing

### Implementation
Modify `artifacts/dashboard/src/components/layout/sidebar.tsx`:
- Replace flat `navigation` array with `navGroups` structure
- Add `Collapsible` or `Accordion` wrapper per group
- Preserve shadcn `SidebarMenuButton` components
- Remove unused icons from imports

## 2. Bold Energetic UI Theme

### Color system
- **Primary**: Blue-to-teal gradient (`from-blue-600 to-teal-500`)
- **Background**: `bg-gradient-to-br from-slate-50 to-blue-50` (light gradient instead of flat gray)
- **Card backgrounds**: `bg-white/80 backdrop-blur-sm` (glass-morphism)
- **Accents**: Emerald green, amber, violet for status indicators
- **Text**: Slate-900 headings, slate-600 body, primary action text

### Typography
- **Headings**: `tracking-tight font-bold` (already used, keep)
- **Stats**: `text-3xl md:text-4xl font-extrabold` with gradient text effect
- **Labels**: `text-xs uppercase tracking-widest text-slate-500`

### Cards
- `rounded-2xl` corner radius (16px)
- `shadow-sm hover:shadow-md transition-shadow` lift effect
- Glass effect: `bg-white/80 backdrop-blur-sm border border-white/50`

### Dashboard hero section
- Gradient background: `bg-gradient-to-br from-blue-600 via-blue-500 to-teal-400`
- White text, large welcome and date
- Subtle decorative elements (blurred circles)

### Stats cards
- Compact grid of 4 cards
- Large number with gradient text
- Icon in colored circle
- Trend indicator (up/down arrow with green/red)

### Quick actions
- Gradient button: `bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600`
- White text, rounded, prominent CTA

## 3. Dashboard Prototype

### Layout (top to bottom)
```
┌─────────────────────────────────────────────┐
│ [Hero] Welcome back, [Name]                  │
│        Date · Motivation quote               │
├─────────────────────────────────────────────┤
│ [Stats] Jobs | Apps | Resumes | CoverLetters │
├─────────────────────────────────────────────┤
│ [Quick Actions]                              │
│ [New Job] [Tailor Resume] [Check Trends]     │
├──────────────────────┬──────────────────────┤
│ [Recent Activity]    │ [Daily Inspiration]   │
│ card feed            │ rotating quote card   │
│                      │ + Resources link      │
├──────────────────────┴──────────────────────┤
│ [Job Board] Latest matches (if any)          │
└─────────────────────────────────────────────┘
```

### Hero section
- Full-width gradient banner
- Left: "Welcome back, {firstName}" + "Here's your job search at a glance"
- Right: Current date
- Below: Daily inspirational quote (soft white text, italic)

### Stats grid
4 cards in a `grid-cols-2 md:grid-cols-4` layout:
- Active Jobs
- Total Applications
- Pending Resumes
- Pending Cover Letters

Each card: glass-morphism, large number, trend icon, label

### Quick actions
3 buttons in a horizontal row:
- **New Job** → `/jobs` (primary gradient)
- **Tailor Resume** → `/resume-versions` (outlined, subtle gradient border)
- **Market Trends** → `/trends` (outlined, subtle gradient border)

### Activity feed
- Recent 5 events (job created, resume tailored, cover letter drafted)
- Color-coded badges: green=approved, amber=pending, blue=created
- Relative timestamps

### Daily Inspiration
- Card with light gradient background (amber-to-orange)
- Quote icon + text + attribution
- Auto-rotates between 10-15 curated quotes
- "Need resources?" link below → `/resources`

### Implementation
Modify `artifacts/dashboard/src/pages/dashboard/index.tsx` — replace current layout with new structure.

## 4. Daily Inspiration Widget

### Data
Static array of 15 curated quotes. No API needed. Stored in a new file:
- Create `artifacts/dashboard/src/lib/inspirational-quotes.ts`

### Display
- `useState` + `useEffect` with `setInterval` for auto-rotation (every 30s)
- New component: `artifacts/dashboard/src/components/daily-inspiration.tsx`

### Quote format
```typescript
{ quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" }
```

## 5. Resources Page

### Route
`/resources` — new page accessible from sidebar (under Settings or footer link)

### Content sections
- **Free Learning Platforms**: Coursera (free tier), edX, Khan Academy, freeCodeCamp, MIT OpenCourseWare
- **Career Resources**: LinkedIn Learning free courses, Google Career Certificates, GitHub Learning Lab
- **Mental Health**: Crisis Text Line, NAMI, BetterHelp financial aid, local resources
- **Financial Assistance**: SNAP, Medicaid, unemployment benefits (links to .gov sites)

### Implementation
- Create `artifacts/dashboard/src/pages/resources/index.tsx`
- Add route in `App.tsx`
- Add sidebar link under Settings group
- Static content, no API needed

## 6. Guide Split

### Current state
`/guide` contains developer/admin content (API setup, schema push, DO deployment) mixed with minimal user guidance.

### New state

**User-facing `/guide`** renamed to **Help & Tips**:
- Getting started
- How each module works (brief, user-focused)
- FAQ
- Removes all deployment, schema, API key setup content

**Admin-facing `/admin/docs`** (already exists):
- Keep existing developer/admin content here
- Add deployment instruction, DB management, env setup
- Only visible to admin users (already conditional)

### Implementation
- Modify `artifacts/dashboard/src/pages/guide/index.tsx` — strip admin content, rewrite for users
- Move admin content to `artifacts/dashboard/src/pages/admin/docs/index.tsx`
- Update sidebar label: "Guide" → "Help & Tips"

## Rollout Order

1. Console error fix (done)
2. Dashboard prototype — user reviews at `localhost:5173/dashboard`
3. Navbar groups — user reviews sidebar
4. Remaining UI pages (all use new style tokens)
5. Daily inspiration widget
6. Resources page
7. Guide split

## Self-Review

- **Placeholder scan**: No TBD or TODO items
- **Internal consistency**: Navbar groups align with page routes, all components use consistent theme tokens
- **Scope**: 7 changes across 5 areas, achievable in one plan
- **Ambiguity**: None — all components, routes, and visual decisions specified
