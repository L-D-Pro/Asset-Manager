# JD Parse Pre-processor for Chat

**Date:** 2026-05-17  
**Status:** Approved

## Problem

When a user pastes a raw job description into the chat to tailor their resume, the main (expensive) chat model receives 1,000–3,000 tokens of unstructured job posting text and must extract requirements itself before it can reason about tailoring. This is wasteful: extraction is a well-defined task that a cheap small model handles accurately, while the main model's value is in synthesis and tailoring.

## Solution

Introduce a **JD Parse pre-processor** that runs transparently before the main chat stream. When the user enables "JD Parse" in the composer, the API routes the message body through the existing `jd_parsing` model (cheap, fast) first, extracts structured data, injects it into the chat context, then streams the main model with clean structured input. The main model is instructed not to re-extract.

## Architecture

```
User sends message (raw JD pasted inline + tailoring prompt)
        │
        ▼
POST /chat/threads/:id/messages  { jdParseEnabled: true }
        │
        ├── [~2-3s] parseJdText(messageContent)
        │     └── callAI({ taskScope: 'jd_parsing', ... })  ← cheap model via model router
        │     └── returns ParsedJd (ephemeral, no DB write)
        │
        ▼
streamChatCompletion({ ..., parsedJd })
        │
        ├── context-builder injects ParsedJd block into system context
        └── main model streams with structured JD + original prompt
```

The existing `jd-parse.ts` pipeline (used by job routes) is **not modified**. The chat pre-processor is a separate, ephemeral path.

## Components

### Backend

**`artifacts/api-server/src/lib/chat/jd-parse-preprocess.ts`** (new file)

- Exports `parseJdText(text: string, userId: string): Promise<ParsedJd>`
- Calls `callAI()` with `taskScope: 'jd_parsing'` — uses the model router, so the model is configurable via `ai_model_configs`
- Uses the same extraction system prompt as the existing pipeline (or a prompt version registered under `jd_parsing` scope)
- Returns structured `ParsedJd`: role, company, requiredSkills, niceToHaveSkills, keywords, seniority, location, remoteType
- **No database write** — result is ephemeral, used only within the request lifecycle

**`artifacts/api-server/src/routes/chat.ts`** (modified)

- `POST /chat/threads/:id/messages` accepts new optional boolean field `jdParseEnabled`
- If true: call `parseJdText(messageContent)` before `streamChatCompletion`
- Pass `parsedJd` result into `streamChatCompletion` options

**`artifacts/api-server/src/lib/chat/context-builder.ts`** (modified)

- Accept optional `parsedJd?: ParsedJd` parameter
- If present, inject a labeled block into the system context:

```
## Job Description (pre-parsed — do not re-extract)
Role: {role} at {company}
Required: {requiredSkills}
Nice-to-have: {niceToHaveSkills}
Seniority: {seniority}
Keywords: {keywords}
Location: {location} ({remoteType})
```

- The existing system prompt gets an appended instruction: "A structured job description is provided above. Use it as the authoritative source. Do not re-extract or re-summarize the job posting."

**`artifacts/api-server/src/lib/chat/stream-openrouter.ts`** (modified)

- Pass `parsedJd` through to `context-builder` when building the system prompt

### Frontend

**`artifacts/dashboard/src/pages/chat/index.tsx`** (modified)

- Add `jdParseEnabled: boolean` to local composer state, default `false`
- Add **"JD Parse" toggle button** in the attachment row (alongside Resume, Job, Claims, File)
  - Highlighted/active state when enabled
  - Tooltip: "Pre-parse job description with a fast model before sending"
- Include `jdParseEnabled` in the message POST request body
- When `jdParseEnabled` and awaiting first stream token: show **"Analyzing job description…"** in the pre-stream loading state (extends the existing loading indicator, no new component needed)

### Control Plane

`jd_parsing` must be a selectable task scope in the AI model config UI so an admin can assign a cheap model (e.g., Haiku). This requires the same fix as the "add config only shows chat scope" bug — make the task scope dropdown in the create/edit dialog pull from the full valid scope enum rather than a hardcoded list.

Once configured, `parseJdText` picks it up automatically via the model router. If no config exists, it falls back to the default model.

## Request/Response Shape

```typescript
// POST /chat/threads/:id/messages
{
  content: string;          // full message — prompt + pasted JD
  jdParseEnabled?: boolean; // new optional field
  // ... existing fields unchanged
}
```

## What Does Not Change

- `artifacts/api-server/src/lib/pipelines/jd-parse.ts` — untouched
- Job routes — untouched
- Chat thread/message data model — no new columns
- SSE protocol — no new event types; pre-stream loading state already exists

## Out of Scope

- Saving the parsed JD to the database or linking it to a job record
- Detecting JD text automatically (user explicitly toggles the feature)
- Streaming partial parse results to the client

## Related Fixes (same branch)

1. **Rename Admin → Settings** in sidebar nav and move AI Metrics under it
2. **Fix ai-metrics edit rows**: wire table rows to the PATCH endpoint
3. **Fix add config scope**: replace hardcoded "chat" with full task scope enum
