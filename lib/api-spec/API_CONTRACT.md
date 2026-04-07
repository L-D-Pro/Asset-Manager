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
| GET | `/claims/:id` | Get a single claim |
| PATCH | `/claims/:id` | Update a claim |
| DELETE | `/claims/:id` | Delete a claim |

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

Event logs are read-only. No create/update/delete endpoints are exposed.

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
