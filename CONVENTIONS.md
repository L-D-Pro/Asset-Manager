# Conventions

## TypeScript Configuration

The project uses TypeScript 5.9 with project references for incremental compilation.

**Root `tsconfig.json`** declares project references to `lib/db`, `lib/api-client-react`, `lib/api-zod`, and `lib/integrations-openrouter-ai`. These are the shared lib packages that are built as composites.

**`tsconfig.base.json`** defines the shared compiler options:
- `"strict": true` — all strict checks enabled
- `"moduleResolution": "bundler"` — used by Vite-based packages
- `"module": "ESNext"`, `"target": "ES2022"`
- `"composite": true` on lib packages (enables incremental build and project references)

**Artifact packages** (`artifacts/*`) each have their own `tsconfig.json` that extends `tsconfig.base.json` but are not part of the root project references (they are checked separately via `pnpm -r typecheck`).

**To typecheck everything**:
```bash
pnpm run typecheck
# = pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" run typecheck
```

## Naming Conventions

### Files
- Route handlers: `artifacts/api-server/src/routes/<entity-plural>.ts` (e.g. `jobs.ts`, `claims.ts`)
- Schema files: `lib/db/src/schema/<entity-plural>.ts` (e.g. `jobs.ts`, `role-profiles.ts`)
- Pipeline files: `artifacts/api-server/src/lib/pipelines/<verb>-<noun>.ts` (e.g. `jd-parse.ts`, `resume-tailor.ts`)
- React page components: `artifacts/dashboard/src/pages/<entity-plural>/index.tsx`

### Database
- Table names: `snake_case`, plural (e.g. `job_applications`, `cover_letter_versions`)
- Column names: `snake_case`
- Index names: `<table>_<columns>_idx` (e.g. `jobs_status_idx`)

### TypeScript
- Types/interfaces: `PascalCase` (e.g. `JobScoreResult`, `AiCallOptions`)
- Functions: `camelCase` (e.g. `selectModelForTask`, `validateBullet`)
- Constants: `UPPER_SNAKE_CASE` for top-level module constants (e.g. `SYSTEM_PROMPT`)
- Drizzle table exports: `<entity>Table` pattern (e.g. `jobsTable`, `claimsTable`)
- Insert schema exports: `insert<Entity>Schema` (e.g. `insertJobSchema`)
- Type exports: `Insert<Entity>` and `<Entity>` (e.g. `InsertJob`, `Job`)

### API Endpoints
- RESTful, kebab-case resource names (e.g. `/role-profiles`, `/resume-versions`)
- Action sub-routes use verb: `/approve`, `/reject`, `/parse`, `/tailor`, `/score`

## `@workspace/*` Import Patterns

Workspace packages are imported by their declared name in their `package.json`:

```typescript
// DB client and all table refs + types
import { db, jobsTable, claimsTable, type Job, type Claim } from "@workspace/db";

// Generated TanStack Query hooks (dashboard only)
import { useListJobs, useCreateJob } from "@workspace/api-client-react";

// Generated Zod schemas (API server only)
import { createJobBodySchema } from "@workspace/api-zod";

// OpenRouter AI client (API server only)
import { openrouter } from "@workspace/integrations-openrouter-ai";
```

All workspace packages are listed in `pnpm-workspace.yaml` under `packages:` and must be present in the consuming package's `package.json` `dependencies` with `"workspace:*"` as the version.

## Error Handling Approach

### API Server
- Route handlers do not use global `try/catch` wrappers. Express 5 natively propagates `async` errors to the error middleware.
- Business logic errors use plain `Error` with a descriptive message.
- Truth-lock failures use the typed `TruthLockViolation` class (from `pipelines/validation.ts`) so callers can distinguish them from unexpected errors.
- 404s: `res.status(404).json({ error: "Not found" })`
- 409s (state machine violations): `res.status(409).json({ error: "..." })`
- 400s (validation): `res.status(400).json({ error: parsed.error.flatten() })`
- Avoid silent fallbacks. If something unexpected happens, log it and surface it.

### Dashboard
- API hook errors are surfaced via `useToast()` toasts. Every mutation has `onError` handler that shows a descriptive toast.
- No silent swallowing of errors. If an operation fails, the user sees it.
- Type assertions (`x as T`) are preferred over `try/catch` for plain type casts that cannot throw.
- Runtime guards (`Array.isArray(x)`, `typeof x === "string"`) are used before casting when the shape is truly unknown.

## Environment Variables and Secrets

**Never hardcode secrets or environment-specific values.** Use the root `.env` locally and platform-managed secrets in production.

| Variable | Where used | Description |
|----------|-----------|-------------|
| `DATABASE_URL` | `lib/db/src/client.ts` | PostgreSQL connection string |
| `SESSION_SECRET` | `artifacts/api-server/src/app.ts` | Session signing secret, at least 32 chars |
| `PORT` | API/dashboard dev servers | Port the server binds to; API defaults to 8080, dashboard defaults to 5173 |
| `API_SERVER_URL` | `artifacts/dashboard/vite.config.ts` | Optional Vite dev proxy target override |
| `ALLOWED_ORIGINS` | `artifacts/api-server/src/app.ts` | Comma-separated production CORS origins |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | `@workspace/integrations-openrouter-ai` | OpenRouter API endpoint |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | `@workspace/integrations-openrouter-ai` | OpenRouter API key |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | `artifacts/api-server/src/index.ts` | First-run admin bootstrap only |

The API server loads the root `.env` through Node's `--env-file-if-exists` flag in normal start scripts. Remove `ADMIN_*` vars after the first successful bootstrap in production.

## Shared Library Patterns

### Drizzle ORM (`@workspace/db`)
- All DB queries use the typed Drizzle query builder. Raw SQL is avoided.
- `.returning()` is always used after `insert`, `update`, and `delete` to get the persisted row.
- `db.select().from(table).where(...)` pattern for reads.
- `eq`, `and`, `or`, `isNull`, `isNotNull` from `drizzle-orm` for conditions.
- Always import both the table and the type from `@workspace/db` (e.g. `import { db, jobsTable, type Job }`).

### Zod Validation
- Generated schemas from `@workspace/api-zod` are used for request validation.
- `schema.safeParse()` is used in handlers; `.parse()` is never used in handlers (would throw rather than return a 400).
- `drizzle-zod` (`createInsertSchema`) generates insert schemas from Drizzle table definitions, with `id`, `createdAt`, and `updatedAt` omitted.

### Logging (`lib/logger.ts`)
- `pino` logger exported as `logger` from `artifacts/api-server/src/lib/logger.ts`.
- `logger.info`, `logger.warn`, `logger.error`, `logger.debug` — structured JSON logging.
- Always include a context object as the first argument (e.g. `logger.info({ jobId }, "Starting pipeline")`).
- Never log secrets or user PII.

## Testing Philosophy

Verification rests on several layers:

1. **TypeScript** (`pnpm run typecheck`) catches structural errors at the boundary between all packages.
2. **Unit / route tests (Vitest)** — `cd artifacts/api-server && pnpm test` runs the api-server suite (~29 files, 200+ tests covering validation, pipelines, run lineage enforcement, chat prompt assembly, and route handlers). The script loads `.env` via `--env-file-if-exists`, so AI/DB-dependent tests need those vars set.
3. **End-to-end (Playwright)** — `cd artifacts/dashboard && pnpm test:e2e` drives the dashboard against a running instance.
4. **EventLog as audit trail** — every AI call and state change is logged, enabling post-hoc debugging.
5. **Structured error responses** — all API errors are logged and returned in a consistent format so callers can surface them clearly.

Future: broaden route-handler coverage and add E2E flows for auth, base resume import, AI draft claims, AI Review, Assisted Apply, and Freelance Copilot.

## pnpm Workspace Security Policy

`pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` minutes (1 day) on all package installs. This guards against supply-chain attacks where malicious packages are published and pulled within hours. Replit-owned packages (`@replit/*`) are excluded from this policy.

Do not set `minimumReleaseAge` to 0 or remove it. If an urgent package update is needed before the 1-day window, add it to `minimumReleaseAgeExclude` temporarily, then remove the exclusion once the window has passed.
