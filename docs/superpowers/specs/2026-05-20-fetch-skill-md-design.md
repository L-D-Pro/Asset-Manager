# Fetch Skill from GitHub — Design Spec

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** AI Control Plane → Skills card

---

## Overview

Add a "Fetch from URL" button to the Skills card in the AI Control Plane. The user pastes a GitHub URL pointing to a `SKILL.md` file, the app fetches and parses it in the browser, then pre-populates the existing Add Skill editor modal so the user can review and edit before saving.

---

## Architecture

**Frontend-only fetch (no backend changes).** `raw.githubusercontent.com` serves content with open CORS headers, so the browser can fetch directly. No new API routes, no OpenAPI codegen, no backend involvement.

All new code lives in `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx`.

---

## Components

### `FetchSkillModal` (new)

A small modal rendered via the existing `Portal` component.

**Fields:**
- URL `<input>` — accepts any of:
  - `https://github.com/:owner/:repo/blob/:branch/:path` (transformed to raw)
  - `https://raw.githubusercontent.com/...` (used as-is)
- Fetch button with loading state
- Inline error message on failure

**URL transform logic:**
```
github.com/:owner/:repo/blob/:branch/:rest
  → raw.githubusercontent.com/:owner/:repo/:branch/:rest
```

**Parsing logic (client-side):**
1. Strip YAML frontmatter (text between opening and closing `---`)
2. Extract `name:` field from frontmatter → `roleLabel`
3. Derive `label` from the path segment immediately before the filename (e.g. `resume-ats-optimizer` from `.../skills/resume-ats-optimizer/SKILL.md`)
4. Body = everything after the closing `---` (trimmed)

**On success:** calls `onFetched({ label, roleLabel, body })` and closes.  
**On error:** shows inline message ("Could not fetch — check the URL and try again"), stays open.

### `SkillEditorModal` (modified)

Accepts a new optional prop: `prefill?: { label: string; roleLabel: string; body: string }`.

When `prefill` is provided, initialize `label`, `roleLabel`, and `body` state from it. Existing behavior is unchanged when `prefill` is absent.

### `SkillsCard` (modified)

- Add "Fetch from URL" button in the card header, next to "Add skill". Hidden during preview mode (same as "Add skill").
- New state: `fetchOpen: boolean`
- New state: `skillPrefill: { label, roleLabel, body } | null`
- When `FetchSkillModal` calls `onFetched`: set `skillPrefill`, set `fetchOpen = false`, set `adding = true` → opens `SkillEditorModal` pre-filled.
- When `SkillEditorModal` closes (save or cancel): clear `skillPrefill`.

---

## Data Flow

```
User clicks "Fetch from URL"
  → FetchSkillModal opens
  → User pastes URL, clicks Fetch
  → Browser fetches raw.githubusercontent.com content
  → Parse frontmatter + body
  → onFetched({ label, roleLabel, body })
  → FetchSkillModal closes
  → SkillEditorModal opens with prefill
  → User reviews/edits fields, clicks Save
  → Existing create mutation fires
  → Skill appears in list
```

---

## Error Handling

- Non-GitHub URLs: show inline error "Only GitHub URLs are supported."
- Fetch fails (404, network): show inline error "Could not fetch — check the URL and try again."
- Frontmatter missing `name`: fall back to empty `roleLabel` (user fills it in the editor).
- Body empty after stripping frontmatter: show inline error "SKILL.md body is empty."

---

## Out of Scope

- Private repo support (no auth token handling)
- Non-GitHub hosts (GitLab, Bitbucket, etc.)
- Auto-saving without review (user always sees the editor before saving)
- Backend proxy route (deferred — revisit if CORS issues emerge in practice)
