# UI Shell Experiment Summary

This document records the full UI Shell experiment for the authenticated Job Ops product surface.
It explains the original intent, the architecture we introduced, the phases we moved through, the visual/theming work, the issues we ran into, and the current state of the implementation.

## 1. Executive Summary

The experiment started as an attempt to build a portable `ui-core` system that could be reused across multiple Node.js applications.
The main goals were:

- Create a slot-based UI orchestration system instead of hard-coded dashboard composition.
- Persist UI state in JSON so the frontend stays renderer-driven.
- Introduce a semantic theme engine powered by CSS variables.
- Support imported palettes, especially HigoCreative color sets.
- Move the logged-in application toward a more premium Apple/Stratify-inspired visual language.

The work succeeded structurally:

- The slot-based UI Shell architecture is now in place.
- The backend persistence model and admin APIs exist.
- The dashboard and sidebar can be reordered, renamed, hidden, and persisted.
- A shared `packages/ui-core` package exists and now owns key orchestration and theme primitives.
- The theme system supports 40+ built-in themes.

The work has been more mixed visually:

- We initially succeeded in making the app configurable.
- We then expanded the palette system aggressively.
- That first expansion caused poor visual outcomes because theme colors bled into structural surfaces too directly.
- We then corrected the mapper so palettes act as accent systems instead of repainting the entire shell.

At the time of this writing, the architecture is substantially implemented, but the visual direction still needs a final live review in a healthy local environment to confirm the shell now feels premium rather than overly tinted.

## 2. Original Intent

The original request was not just "add themes."
It was to build a reusable UI orchestration core with these constraints:

- Portable package under `packages/ui-core`
- Slot-based layout, not free-form Elementor
- Semantic theming, not direct hex-per-component coloring
- JSON-first persistence
- Admin controls for labels, order, visibility, and theme selection
- Strong visual identity influenced by Stratify / Apple-style dashboards

The important architectural shift was:

- Business logic remains in the app.
- Layout orchestration and theme logic move into a reusable core.
- The frontend becomes a renderer of config, not the owner of layout state.

## 3. Architectural Constraints We Adopted

During the implementation, the plan was refined with several important constraints.
These ended up shaping the final system:

### 3.1 Slot-Based Layout Only

We explicitly did **not** build a free-form page builder.
The allowed configurable zones are:

- `navbar`
- `sidebar`
- `dashboardGrid`

The core shell remains stable and hard-coded:

- auth
- profile/account
- settings structure
- general app frame

This preserved spacing, alignment, and dashboard discipline.

### 3.2 Semantic Token Protection

We moved away from "apply a raw palette directly to every surface."
Instead, palettes map to semantic roles such as:

- background
- glass/background secondary
- card/elevated surface
- border subtle / strong
- text main / subtle
- brand primary / accent
- focus ring

This is the only way to keep palette swapping from collapsing the visual hierarchy.

### 3.3 JSON-First Persistence

The frontend does not own the real shell configuration.
It reads and writes a JSON structure persisted on the backend.

That structure contains:

- `order`
- `visibility`
- `label`
- `themeID`

This was a central requirement and has been implemented.

## 4. High-Level Implementation Phases

## Phase 0: Scaffolding and Direction Setting

We established the target shape of the system:

- `packages/ui-core` for reusable theme/orchestration logic
- dashboard app as first consumer
- backend routes to persist shell configuration
- strict slot contracts instead of generic layout metadata

This phase was mostly architectural.

## Phase 1: UI Core and Schema Foundation

The shared package and config contracts were introduced.
This includes:

- theme types
- theme provider
- semantic theme token mapping
- orchestration schema
- sortable primitives for slot items

Key outcome:

- The repo now has a real shared core instead of app-local ad hoc theme/layout code.

## Phase 2: Backend Persistence and API Contracts

We added backend storage for the UI Shell configuration and the admin APIs needed to manage it.

Primary route:

- `artifacts/api-server/src/routes/ui-shell-configs.ts`

The API surface includes:

- `GET /admin/ui-shell-configs/:appKey`
- `PUT /admin/ui-shell-configs/:appKey`
- `POST /admin/ui-shell-configs/:appKey/reset`

The backend validates:

- slot structure
- item shape
- duplicate ids within a slot
- theme definitions payload shape

The DB schema includes a single config record per `appKey`, storing:

- `theme_id`
- `theme_definitions`
- `ui_config`

This was a major milestone because it made the UI Shell real, not just local state.

## Phase 3: Admin UI Shell Screen

We added an admin page that can:

- select a theme
- reorder slot items
- rename slot items
- toggle visibility
- save/reset persisted shell state

Primary route/page:

- `artifacts/dashboard/src/pages/admin/ui-shell/index.tsx`

This was the first visible proof that the orchestration layer was working.

## Phase 4: Dashboard and Sidebar Consumption

The dashboard and featured sidebar cards were wired to consume the persisted shell config.

This included:

- reading slot order
- applying visibility
- rendering renamed labels
- keeping only approved component keys in the registry

Important scope rule:

- only approved items are configurable
- the layout frame is not free-form
- core navigation groups remain stable

This phase delivered the actual product-facing orchestration behavior.

## Phase 5: Theme Expansion to 40+ Higo Themes

We expanded the theme library dramatically.

Current built-in themes:

- 41 total themes
- based on extracted HigoCreative palette families

Initial implementation details:

- themes were generated from palette arrays
- semantic palette fields were derived from those hex sets
- theme selection was added to the admin UI Shell page

This phase achieved the "40+ palettes" requirement, but it also exposed the next major problem.

## Phase 6: Visible Redesign Pass

We moved beyond pure configurability and started redesigning the authenticated product surface.

This included:

- `PageHeader` semantic variants
- shared `ContentCard` styling
- stat card styling
- dashboard composition cleanup
- sidebar polish
- shell background/topbar/footer normalization
- route-level cleanup for key logged-in pages

Targeted routes included:

- `/dashboard`
- `/jobs`
- `/jobs/:id`
- `/admin/ui-shell`
- `/ai-review`
- `/resume-versions`
- `/account`

This phase was where "make it visibly different" entered the implementation in a serious way.

## Phase 7: Theme Flood Debugging and Semantic Recovery

After the large Higo palette rollout, the visual result became too literal.
Certain themes, especially pink ones, painted nearly every structural surface with palette color.

Symptoms:

- pink sidebar
- pink cards
- pink page backgrounds
- low visual hierarchy
- theme felt like full-page tint instead of curated system styling

This was not aligned with the original design intent.

We corrected this by tightening the theme mapper:

- backgrounds moved back toward neutral foundations
- surfaces became protected system surfaces
- palette colors stayed in accents, controls, outlines, rings, and light tinting
- built-in themes now override stale persisted built-in theme definitions when loaded from the server

This recovery work is one of the most important parts of the experiment because it clarified the difference between:

- **palette ingestion**
and
- **design system control**

## 5. Key Files Introduced or Heavily Changed

This is not every file touched, but it is the most important set for understanding the experiment.

### Shared Core

- `packages/ui-core/src/theme/theme-types.ts`
- `packages/ui-core/src/theme/theme-mapper.ts`
- `packages/ui-core/src/theme/theme-provider.tsx`
- `packages/ui-core/src/orchestration/*`
- `packages/ui-core/src/styles/*`

### Dashboard App

- `artifacts/dashboard/src/ui-shell/default-config.ts`
- `artifacts/dashboard/src/ui-shell/use-ui-shell-config.ts`
- `artifacts/dashboard/src/pages/admin/ui-shell/index.tsx`
- `artifacts/dashboard/src/pages/dashboard.tsx`
- `artifacts/dashboard/src/components/layout/sidebar.tsx`
- `artifacts/dashboard/src/components/layout/main-layout.tsx`
- `artifacts/dashboard/src/components/ui/page-header.tsx`
- `artifacts/dashboard/src/components/ui/content-card.tsx`
- `artifacts/dashboard/src/components/ui/stats-card.tsx`
- `artifacts/dashboard/src/components/ui/status-badge.tsx`
- `artifacts/dashboard/src/index.css`
- `artifacts/dashboard/src/App.tsx`

### Backend

- `artifacts/api-server/src/routes/ui-shell-configs.ts`
- `artifacts/api-server/src/routes/index.ts`
- `lib/db/src/schema/ui-shell-configs.ts`
- `lib/db/runtime-compat.sql`

### Generated Contract Files

- `lib/api-spec/openapi.yaml`
- regenerated files in `lib/api-zod`
- regenerated files in `lib/api-client-react`

## 6. What the UI Shell Does Today

As currently implemented, the UI Shell supports:

- persisted theme selection
- persisted navbar featured-card order
- persisted dashboard widget order
- persisted visibility toggles
- persisted label changes
- server-backed rehydration after reload

It does **not** support:

- arbitrary drag-anywhere layout
- free-form x/y widget placement
- unrestricted shell editing
- public/auth page theming orchestration as part of this pass

This is by design.

## 7. Major Issues We Faced

## 7.1 UI Config Persistence Initially Failed

At one point, saving UI Shell state returned `500` errors.

Key causes included:

- missing schema/table support
- route integration still in progress
- mismatches between default config expectations and persisted state

This was resolved through:

- schema creation/compat logic
- route validation
- safer config normalization

## 7.2 Saved Server Themes Overrode Improved Built-In Themes

Even after improving the built-in theme definitions, the app still showed old results.
The reason was subtle:

- old theme definitions had already been persisted
- the frontend loaded those server copies
- those stale copies overrode the new local built-ins

This made it look like changes were "not working."

We fixed this by merging server themes in a way that preserves custom server themes while letting built-in ids use the current built-in definitions.

## 7.3 Theme Flood / Semantic Failure

This was the largest visual problem.

What went wrong:

- Higo palette extraction worked technically
- semantic token mapping was too literal
- the shell lost neutrality and hierarchy

What we changed:

- neutralized structural surfaces
- retained strong accent usage
- reduced global tinting
- removed glow effects that exaggerated color wash

## 7.4 Build and Runtime Environment Friction

We also hit unrelated but important environment issues while trying to verify the work:

### Database Startup Failure

The API server failed with:

- `Authentication timed out`
- Postgres error code `08P01`

We updated DB connection handling to better respect hosted Postgres SSL requirements:

- `lib/db/src/index.ts`

### Vite Proxy `ECONNREFUSED`

Dashboard dev errors such as:

- `/api/auth/me`
- `/api/activity-feed`
- `/api/auth/login`

were downstream effects of the API server not starting.

### Windows `EPERM` and Locking Issues

We also hit Windows-specific permission/locking problems:

- `esbuild` spawn `EPERM`
- `lib/db/dist/*` write failures
- `tsconfig.tsbuildinfo` write failures

These did not all originate from the UI Shell work itself, but they slowed verification and made debugging feel noisier than it should have.

## 8. What Was Validated

At different checkpoints we validated:

- dashboard typecheck
- api-server typecheck
- API route shape
- JSON persistence shape
- slot reorder/visibility/rename behavior
- theme list expansion
- logged-in legacy-class cleanup in scoped areas

Repeatedly passing checks:

- `corepack pnpm --filter @workspace/dashboard run typecheck`
- `corepack pnpm --filter @workspace/api-server run typecheck`

The system has therefore been validated more strongly at the code and contract level than at the final visual QA level.

## 9. What Was Intentionally Out of Scope

This experiment focused on the authenticated product surface.

Public/auth pages were intentionally not the focus:

- landing
- login
- register
- reset password
- verify email
- not found

Those still contain older visual patterns and were not the target of the UI Shell orchestration effort.

## 10. Current Status

This is the most important section for handoff clarity.

### Implemented

- Shared `ui-core` theme/orchestration layer exists.
- Slot-based UI shell exists.
- Backend persistence exists.
- Admin UI shell page exists.
- Dashboard and featured sidebar config consumption exist.
- 41 built-in Higo-derived themes exist.
- Theme picker includes swatches and preview.
- Stale persisted built-in theme override issue has been addressed.
- Theme flood recovery work has been applied.

### Partially Complete / Needs Live Review

- The final visual quality still needs live review after the latest semantic tightening.
- The architecture is much further along than the final aesthetic signoff.
- The system is now structurally sound enough for review, but the final "does this feel premium and Apple/Stratify-inspired?" question still needs an honest eyeball pass in a working local dev session.

### Known Environment Risks

- API server startup can still be blocked by DB connectivity or SSL/environment issues.
- Windows file-lock behavior has interfered with `lib/db` artifact emission.
- `esbuild` execution has shown `EPERM` issues in this environment.

These are not conceptual blockers for the UI Shell architecture, but they are practical blockers for smooth local verification.

## 11. Honest Assessment

The experiment delivered the architecture more successfully than the first round of visual expression.

What went well:

- The orchestration model is real.
- The persistence layer is real.
- The shared package direction is real.
- The slot-based constraint was respected.
- The semantic theming model exists and is much healthier after the mapper recovery.

What did not go well:

- The first palette expansion pushed too much color into the shell.
- Some early "implemented" milestones were functionally true but visually underwhelming.
- Repeated environment friction made it harder to separate design problems from runtime/setup problems.

Most important lesson:

- A multi-theme system needs **design discipline more than color volume**.
- Palette count is not the same thing as a good product surface.
- Semantic protection of surfaces is mandatory if the product is supposed to feel premium.

## 12. Suggested Next Steps

The best next steps from here are:

1. Get local API server and dashboard fully stable in dev.
2. Review 5-8 representative themes in a working UI session.
3. Pick 1 default light theme and 1 default dark theme for product use.
4. Reduce the active theme set shown to admins if the full 41-theme list feels noisy.
5. Run a final visual refinement pass only after the environment is stable.

That order matters.
Without a stable local environment, visual review becomes guesswork.

## 13. Bottom Line

The UI Shell experiment is no longer just an idea.
It now exists as a real slot-based, JSON-backed, theme-aware orchestration layer in the codebase.

The current state is:

- **Architecture:** substantially implemented
- **Persistence:** implemented
- **Admin controls:** implemented
- **Theme library:** implemented
- **Visual redesign:** partially successful, still under refinement
- **Environment stability for final review:** currently uneven

This means the experiment has crossed from planning into actual platform capability, but it has **not** yet earned final aesthetic signoff.
