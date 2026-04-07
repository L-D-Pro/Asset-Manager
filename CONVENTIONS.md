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

**Never hardcode secrets or environment-specific values.** All secrets and config are managed via Replit's environment variable system.

| Variable | Where used | Description |
|----------|-----------|-------------|
| `DATABASE_URL` | `lib/db/src/client.ts` | PostgreSQL connection string |
| `PORT` | `artifacts/api-server/src/index.ts`, `artifacts/dashboard/vite.config.ts` | Port the server binds to |
| `BASE_PATH` | `artifacts/dashboard/vite.config.ts` | Vite base path for Replit proxy routing |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | `@workspace/integrations-openrouter-ai` | OpenRouter API endpoint (Replit-provisioned) |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | `@workspace/integrations-openrouter-ai` | OpenRouter API key (Replit-provisioned) |

The API server throws immediately on startup if `PORT` is missing or invalid. The dashboard falls back to port `5173` and base path `/` if these are absent (safe for local/CI builds). Do not add checks for optional vars that already have safe defaults.

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

No automated test suite exists at this time. The approach to verification is:

1. **TypeScript** (`pnpm run typecheck`) catches structural errors at the boundary between all packages.
2. **End-to-end via the dashboard** — the admin UI exercises all routes with real data.
3. **EventLog as audit trail** — every AI call and state change is logged, enabling post-hoc debugging.
4. **Structured error responses** — all API errors are logged and returned in a consistent format so callers can surface them clearly.

Future: add integration tests for route handlers and unit tests for `scoring.ts` and `validation.ts`.

## pnpm Workspace Security Policy

`pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` minutes (1 day) on all package installs. This guards against supply-chain attacks where malicious packages are published and pulled within hours. Replit-owned packages (`@replit/*`) are excluded from this policy.

Do not set `minimumReleaseAge` to 0 or remove it. If an urgent package update is needed before the 1-day window, add it to `minimumReleaseAgeExclude` temporarily, then remove the exclusion once the window has passed.
