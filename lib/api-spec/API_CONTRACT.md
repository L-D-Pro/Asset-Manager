# API Contract

## Spec-First Workflow

The OpenAPI specification at `lib/api-spec/openapi.yaml` is the single source of truth for the API surface. Two generated packages are produced from it:

| Generated package | What | Where |
|-------------------|------|--------|
| `@workspace/api-client-react` | TanStack Query hooks for the React dashboard | `lib/api-client-react/src/generated/` |
| `@workspace/api-zod` | Zod validation schemas for the API server | `lib/api-zod/src/generated/` |

**To regenerate after editing `openapi.yaml`**:
```bash
pnpm --filter @workspace/api-spec run codegen
```

This runs Orval (`lib/api-spec/orval.config.ts`) which reads `openapi.yaml` and writes both packages.

## Orval Configuration — `orval.config.ts`

Two outputs are configured:

### `api-client-react` output
- **Client**: `react-query` (TanStack Query v5)
- **Mode**: `split` (one file per endpoint group)
- **Base URL**: `/api`
- **Mutator**: `lib/api-client-react/src/custom-fetch.ts` — a custom fetch wrapper with configurable base URL (set at runtime via `setBaseUrl()`), bearer-token auth injection (`setAuthTokenGetter()`), and structured error handling via `ApiError` and `ResponseParseError` classes. The dashboard calls `setBaseUrl()` with the appropriate base path for Replit's path-based proxy routing.
- The title is normalised to `"Api"` via `titleTransformer` so the generated filename is always `api.ts`.

### `zod` output
- **Client**: `zod` (generates Zod schemas from request/response shapes)
- **Mode**: `split`
- **Coercion**: query params, path params, and request bodies are auto-coerced (booleans, numbers, strings, bigints, dates).
- **Date handling**: dates are parsed as JS `Date` objects.

## How to Add a New Endpoint

1. **Edit `openapi.yaml`** — add the path, operation, request body schema, and response schema.
2. **Run codegen** — `pnpm --filter @workspace/api-spec run codegen`
3. **Implement the route handler** in `artifacts/api-server/src/routes/<entity>.ts`
   - Import the generated Zod schema from `@workspace/api-zod` for request validation.
   - Register the route in `artifacts/api-server/src/routes/index.ts`.
4. **Use the generated hook** in the React dashboard via `@workspace/api-client-react`.

## Current Endpoint Inventory

All endpoints are prefixed with `/api`.

### Role Profiles
| Method | Path | Description |
|--------|------|-------------|
| GET | `/role-profiles` | List all role profiles |
| POST | `/role-profiles` | Create a role profile |
| GET | `/role-profiles/:id` | Get a single role profile |
| PATCH | `/role-profiles/:id` | Update a role profile |
| DELETE | `/role-profiles/:id` | Delete a role profile |

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs` | List jobs (filter by `status`, `roleProfileId`) |
| POST | `/jobs` | Create a job |
| GET | `/jobs/:id` | Get a single job |
| PATCH | `/jobs/:id` | Update a job |
| DELETE | `/jobs/:id` | Delete a job |
| POST | `/jobs/:id/parse` | Trigger JD parse pipeline (AI) |
| GET | `/jobs/:id/score` | Score job against a role profile |
| GET | `/jobs/:id/claim-matches` | Get ranked claim matches for this job |
| POST | `/jobs/:id/tailor` | Trigger resume tailor pipeline (AI) |
| POST | `/jobs/:id/cover-letter` | Trigger cover letter pipeline (AI) |

### Claims
| Method | Path | Description |
|--------|------|-------------|
| GET | `/claims` | List claims (filter by `domain`, `isActive`) |
| POST | `/claims` | Create a claim |
| POST | `/claims/draft` | Draft non-persisted claims from pasted text and/or DOCX/PDF upload |
| GET | `/claims/:id` | Get a single claim |
| PATCH | `/claims/:id` | Update a claim |
| DELETE | `/claims/:id` | Delete a claim |

### Base Resume
| Method | Path | Description |
|--------|------|-------------|
| GET | `/base-resume` | Get current base resume |
| GET | `/base-resume/history` | List immutable base resume versions |
| POST | `/base-resume` | Save a new current base resume version |
| POST | `/base-resume/import` | Import DOCX/PDF and save extracted text as current version |
| POST | `/base-resume/:id/restore` | Clone a historical version into a new current version |

### Resume Versions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/resume-versions` | List resume versions (filter by `jobId`, `status`) |
| POST | `/resume-versions` | Create a resume version (manual) |
| GET | `/resume-versions/:id` | Get a single resume version |
| PATCH | `/resume-versions/:id` | Update a resume version |
| DELETE | `/resume-versions/:id` | Delete a resume version |
| POST | `/resume-versions/:id/approve` | Approve (state machine: `pending_approval` → `approved`) |
| POST | `/resume-versions/:id/reject` | Reject (state machine: `pending_approval` → `rejected`) |

### Cover Letter Versions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/cover-letter-versions` | List cover letter versions (filter by `jobId`, `status`) |
| POST | `/cover-letter-versions` | Create a cover letter version (manual) |
| GET | `/cover-letter-versions/:id` | Get a single cover letter version |
| PATCH | `/cover-letter-versions/:id` | Update a cover letter version |
| DELETE | `/cover-letter-versions/:id` | Delete a cover letter version |
| POST | `/cover-letter-versions/:id/approve` | Approve |
| POST | `/cover-letter-versions/:id/reject` | Reject |

### Applications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications` | List applications (filter by `jobId`, `status`) |
| POST | `/applications` | Create an application |
| GET | `/applications/:id` | Get a single application |
| PATCH | `/applications/:id` | Update an application |
| DELETE | `/applications/:id` | Delete an application |
| GET | `/applications/stats` | Aggregate stats (total, by status, interview rate) |

### Event Logs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/event-logs` | List event logs (filter by `entityType`, `entityId`, `jobId`, `applicationId`) |
| POST | `/event-logs` | Create a manual event log entry |
| GET | `/event-logs/:id` | Get a single event log entry |

Event logs are append-only. No update/delete endpoints are exposed.

### Feedback Signals
| Method | Path | Description |
|--------|------|-------------|
| GET | `/feedback-signals` | List feedback signals (filter by `applicationId`, `signalType`) |
| POST | `/feedback-signals` | Create a feedback signal |
| GET | `/feedback-signals/:id` | Get a single feedback signal |
| PATCH | `/feedback-signals/:id` | Update a feedback signal |
| DELETE | `/feedback-signals/:id` | Delete a feedback signal |

### AI Model Configs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai-model-configs` | List all model configs |
| POST | `/ai-model-configs` | Create a model config |
| GET | `/ai-model-configs/:id` | Get a single model config |
| PATCH | `/ai-model-configs/:id` | Update a model config |
| DELETE | `/ai-model-configs/:id` | Delete a model config |

### AI Learning / Review
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai-review/overview` | Recent AI events, evaluations, prompt versions, examples, and stats |
| GET | `/ai-prompt-versions` | List prompt versions |
| POST | `/ai-prompt-versions` | Create prompt version |
| PATCH | `/ai-prompt-versions/:id` | Update prompt version |
| GET | `/ai-run-evaluations` | List AI run evaluations |
| POST | `/ai-run-evaluations` | Create AI run evaluation |
| GET | `/ai-training-examples` | List curated training examples |
| POST | `/ai-training-examples` | Create curated training example |

### Assisted Apply
| Method | Path | Description |
|--------|------|-------------|
| GET | `/site-adapters` | List platform adapter policy records |
| POST | `/site-adapters` | Create platform adapter policy record |
| GET | `/application-sessions` | List assisted-apply sessions |
| POST | `/application-sessions` | Create assisted-apply session |
| GET | `/application-sessions/:id` | Get session with fields and actions |
| POST | `/application-sessions/:id/fields` | Add detected/suggested/approved form field |
| POST | `/application-sessions/:id/actions` | Log assisted-apply action |

### Freelance Copilot
| Method | Path | Description |
|--------|------|-------------|
| GET | `/freelance-profiles` | List contractor/freelance profiles |
| POST | `/freelance-profiles` | Create contractor/freelance profile |
| PATCH | `/freelance-profiles/:id` | Update contractor/freelance profile |
| GET | `/project-sources` | List captured project sources |
| POST | `/project-sources` | Create project source |
| GET | `/freelance-projects` | List freelance projects |
| POST | `/freelance-projects` | Create freelance project |
| POST | `/freelance-projects/:id/score` | Score project fit |
| POST | `/freelance-projects/:id/draft-proposal` | Draft proposal for human review |
| GET | `/proposal-versions` | List proposal drafts |
| POST | `/proposal-versions` | Create proposal draft |
| POST | `/proposal-versions/:id/approve` | Approve proposal draft |
| POST | `/proposal-versions/:id/reject` | Reject proposal draft |
| GET | `/proposal-outcomes` | List proposal outcomes |
| POST | `/proposal-outcomes` | Create proposal outcome |
| GET | `/client-message-templates` | List client message templates |
| POST | `/client-message-templates` | Create client message template |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| GET | `/chat/threads` | List conversation threads |
| POST | `/chat/threads` | Create a new thread |
| PATCH | `/chat/threads/:id` | Rename or update a thread |
| DELETE | `/chat/threads/:id` | Delete a thread |
| GET | `/chat/threads/:id/messages` | List messages in a thread |
| POST | `/chat/threads/:id/messages` | Send a message (streams AI reply) |
| POST | `/chat/messages/:id/feedback` | Submit thumbs up/down on a message |

### Gamification
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/stats` | User XP, level, streaks, counts |
| GET | `/gamification/xp/history` | XP event log |
| GET | `/gamification/achievements` | All achievements with unlock state |
| POST | `/gamification/achievements/:id/seen` | Mark achievement notification seen |
| GET | `/gamification/quests` | Active and available quests |
| POST | `/gamification/quests/:questId/accept` | Accept a quest |
| GET | `/gamification/next-actions` | Suggested next actions for XP |

### Job Board
| Method | Path | Description |
|--------|------|-------------|
| GET | `/job-board/listings` | Browse aggregated job listings (filter: `search`, `location`) |
| GET | `/job-board/sources` | List configured RSS/Atom feed sources |

### Trends
| Method | Path | Description |
|--------|------|-------------|
| POST | `/trends/research` | Trigger AI market research pipeline for a query |

### Resume Utilities
| Method | Path | Description |
|--------|------|-------------|
| POST | `/resume-to-profile` | Extract a role profile from a resume text (AI) |
| POST | `/jobs/:id/resume-score` | Score the current base resume against a job |
| GET | `/resume-templates` | List saved resume templates |
| POST | `/resume-templates` | Create a resume template |
| PATCH | `/resume-templates/:id` | Update a resume template |
| DELETE | `/resume-templates/:id` | Delete a resume template |

### Onboarding
| Method | Path | Description |
|--------|------|-------------|
| GET | `/onboarding/state` | Get current onboarding progress |
| POST | `/onboarding/welcome-seen` | Mark welcome screen as seen |
| POST | `/onboarding/complete-step` | Mark a step complete |
| POST | `/onboarding/dismiss-hint` | Dismiss a contextual hint |

### Wizard Sessions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/wizard-sessions` | List wizard sessions for current user |
| POST | `/wizard-sessions` | Create a wizard session |
| GET | `/wizard-sessions/:id` | Get session state |
| DELETE | `/wizard-sessions/:id` | Delete a session |

### AI Pipeline Overview
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai-pipeline/overview` | Snapshot of pipeline config, active models, and prompt versions |

### AI Metrics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai-metrics/snapshot` | Aggregated AI run stats (costs, tokens, approval rates) |

### Users (Admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users (admin only) |
| PATCH | `/users/:id` | Update user (admin only) |

### Invite Codes (Public + Admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/invite-codes` | List invite codes (admin only) |
| POST | `/invite-codes` | Create an invite code (admin only) |
| DELETE | `/invite-codes/:id` | Delete an invite code (admin only) |
| POST | `/invite-codes/validate` | Validate a code (public) |

### Usage Limits
| Method | Path | Description |
|--------|------|-------------|
| GET | `/usage-limits` | Get current user's usage limits |
| PATCH | `/usage-limits/:id` | Update a usage limit (admin only) |

### Platform Feedback
| Method | Path | Description |
|--------|------|-------------|
| POST | `/feedback` | Submit in-app feedback (rating + comment) |

### Best Practices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/best-practices` | List curated best-practice tips |

### Growth / Landing (Public)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/growth/waitlist` | Join the waitlist |

### Admin Utilities
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/health` | Detailed internal health check (admin only) |
| POST | `/admin/reset` | Reset demo/test data (admin only) |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check — returns `{ status: "ok" }` |

## Zod Validation Strategy

Request validation uses generated Zod schemas from `@workspace/api-zod`. In route handlers:

```typescript
import { createJobBodySchema } from "@workspace/api-zod";

// In the route handler:
const parsed = createJobBodySchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: parsed.error.flatten() });
}
const body = parsed.data; // fully typed
```

Key properties of the generated Zod schemas:
- Query parameters and path parameters are **auto-coerced** from string to the declared type (boolean, number, etc.).
- Request body fields declared as `date` in OpenAPI are parsed to JS `Date` objects.
- Nullable fields are typed as `T | null` and validated correctly.
- The generated schemas mirror the OpenAPI spec exactly — any spec change is reflected after re-running codegen.

## Error Response Format

All endpoints return errors in one of two shapes:

```json
{ "error": "Human-readable message" }
```
or (for validation errors):
```json
{ "error": { "fieldErrors": {}, "formErrors": [] } }
```

404 responses use `{ "error": "Not found" }`. 409 Conflict (state machine violations) use `{ "error": "..." }` with a descriptive message.
