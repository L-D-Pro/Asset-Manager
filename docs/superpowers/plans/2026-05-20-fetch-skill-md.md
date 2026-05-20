# Fetch Skill from GitHub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Fetch from URL" button to the Skills card in the AI Control Plane that fetches a `SKILL.md` from a GitHub URL and pre-fills the Add Skill editor.

**Architecture:** All logic is frontend-only — raw.githubusercontent.com serves with open CORS so the browser fetches directly. URL transform + frontmatter parse are pure helper functions defined at the top of the existing component file. No backend changes, no new files.

**Tech Stack:** React 19, TypeScript strict, inline style conventions (no Tailwind/CSS modules), existing `Portal` component for modal rendering.

---

## File Map

| File | Change |
|------|--------|
| `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx` | Add helpers, `FetchSkillModal`, modify `SkillEditorModal`, modify `SkillsCard` |

No other files change.

---

### Task 1: Add pure helper functions

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx` — add helpers after the `CHAT_SCOPE` constant

These helpers are pure functions with no side effects and easy to reason about in isolation.

- [ ] **Step 1: Add the three helper functions** after the `const CHAT_SCOPE = "chat";` line:

```ts
// ── Fetch-skill helpers ───────────────────────────────────────────────────

function toRawUrl(url: string): string {
  // Transform github.com blob URL → raw.githubusercontent.com
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  if (url.startsWith("https://raw.githubusercontent.com/")) return url;
  throw new Error("Only GitHub blob URLs are supported.");
}

function extractLabelFromUrl(url: string): string {
  const parts = url.replace(/\?.*/, "").split("/").filter(Boolean);
  const mdIdx = parts.findIndex((p) => p.toLowerCase().endsWith(".md"));
  return mdIdx > 0 ? parts[mdIdx - 1] : parts[parts.length - 1];
}

function parseSkillMd(content: string): { roleLabel: string; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { roleLabel: "", body: content.trim() };
  const nameMatch = m[1].match(/^name:\s*(.+)$/m);
  return { roleLabel: nameMatch?.[1]?.trim() ?? "", body: m[2].trim() };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "artifacts/dashboard" && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx
git commit -m "feat(control-plane): add fetch-skill URL transform + parse helpers"
```

---

### Task 2: Add `prefill` prop to `SkillEditorModal`

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx` — update `SkillEditorModal` signature and state initialization

- [ ] **Step 1: Update the `SkillEditorModal` function signature and state initialization**

Find the current signature:
```ts
function SkillEditorModal({ mode, existing, onClose, onSaved }: {
  mode: "edit" | "add";
  existing?: AiPromptVersion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [roleLabel, setRoleLabel] = useState(existing?.roleLabel ?? "");
  const [body, setBody] = useState(existing?.systemPrompt ?? "");
```

Replace with:
```ts
function SkillEditorModal({ mode, existing, prefill, onClose, onSaved }: {
  mode: "edit" | "add";
  existing?: AiPromptVersion;
  prefill?: { label: string; roleLabel: string; body: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(prefill?.label ?? existing?.label ?? "");
  const [roleLabel, setRoleLabel] = useState(prefill?.roleLabel ?? existing?.roleLabel ?? "");
  const [body, setBody] = useState(prefill?.body ?? existing?.systemPrompt ?? "");
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "artifacts/dashboard" && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx
git commit -m "feat(control-plane): add prefill prop to SkillEditorModal"
```

---

### Task 3: Add `FetchSkillModal` component

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx` — add `FetchSkillModal` before `SkillEditorModal`

- [ ] **Step 1: Add the `FetchSkillModal` component** — insert it directly before `function SkillEditorModal`:

```tsx
function FetchSkillModal({ onFetched, onClose }: {
  onFetched: (prefill: { label: string; roleLabel: string; body: string }) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setError(null);
    if (!url.trim()) { setError("Enter a URL."); return; }
    setLoading(true);
    try {
      const rawUrl = toRawUrl(url.trim());
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} — check the URL and try again.`);
      const content = await res.text();
      const { roleLabel, body } = parseSkillMd(content);
      if (!body) throw new Error("SKILL.md body is empty.");
      const label = extractLabelFromUrl(url.trim());
      onFetched({ label, roleLabel, body });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Portal>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 24 }}
        onClick={onClose}
      >
        <div
          style={{ width: 540, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="card-h">
            <h2 className="card-title">Fetch skill from GitHub</h2>
            <button type="button" className="settings-x" onClick={onClose}><X size={14} strokeWidth={2} /></button>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="label" style={{ display: "block", marginBottom: 2 }}>SKILL.md URL</label>
            <input
              className="input"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
              placeholder="https://github.com/owner/repo/blob/main/skills/my-skill/SKILL.md"
              style={{ fontSize: 12.5 }}
            />
            {error && (
              <div style={{ fontSize: 12, color: "var(--danger, #d73a49)", marginTop: 2 }}>{error}</div>
            )}
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn primary sm" disabled={loading} onClick={handleFetch}>
              {loading ? "Fetching…" : "Fetch"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "artifacts/dashboard" && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx
git commit -m "feat(control-plane): add FetchSkillModal component"
```

---

### Task 4: Wire `SkillsCard` with the fetch flow

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx` — update `SkillsCard`

- [ ] **Step 1: Add `fetchOpen` and `skillPrefill` state** to `SkillsCard`

Find the existing state declarations at the top of `SkillsCard`:
```ts
  const [editing, setEditing] = useState<AiPromptVersion | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<AiPromptVersion | null>(null);
```

Replace with:
```ts
  const [editing, setEditing] = useState<AiPromptVersion | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<AiPromptVersion | null>(null);
  const [fetchOpen, setFetchOpen] = useState(false);
  const [skillPrefill, setSkillPrefill] = useState<{ label: string; roleLabel: string; body: string } | null>(null);
```

- [ ] **Step 2: Add the "Fetch from URL" button** to the card header, next to "Add skill"

Find:
```tsx
          {!isPreview && (
            <button type="button" className="btn ghost sm" onClick={() => setAdding(true)}>
              <Plus size={12} strokeWidth={1.8} /> Add skill
            </button>
          )}
```

Replace with:
```tsx
          {!isPreview && (
            <>
              <button type="button" className="btn ghost sm" onClick={() => setFetchOpen(true)}>
                Fetch from URL
              </button>
              <button type="button" className="btn ghost sm" onClick={() => setAdding(true)}>
                <Plus size={12} strokeWidth={1.8} /> Add skill
              </button>
            </>
          )}
```

- [ ] **Step 3: Add `FetchSkillModal` render and pass `prefill` to `SkillEditorModal`**

Find the two modal renders at the bottom of `SkillsCard` (inside the `LeverCard` children):
```tsx
      {editing && (
        <SkillEditorModal
          mode="edit"
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); toast({ title: "Skill updated — new version active" }); }}
        />
      )}
      {adding && (
        <SkillEditorModal
          mode="add"
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); onChanged(); toast({ title: "Skill added" }); }}
        />
      )}
```

Replace with:
```tsx
      {editing && (
        <SkillEditorModal
          mode="edit"
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); toast({ title: "Skill updated — new version active" }); }}
        />
      )}
      {adding && (
        <SkillEditorModal
          mode="add"
          prefill={skillPrefill ?? undefined}
          onClose={() => { setAdding(false); setSkillPrefill(null); }}
          onSaved={() => { setAdding(false); setSkillPrefill(null); onChanged(); toast({ title: "Skill added" }); }}
        />
      )}
      {fetchOpen && (
        <FetchSkillModal
          onClose={() => setFetchOpen(false)}
          onFetched={(prefill) => {
            setSkillPrefill(prefill);
            setFetchOpen(false);
            setAdding(true);
          }}
        />
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "artifacts/dashboard" && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx
git commit -m "feat(control-plane): wire FetchSkillModal into SkillsCard"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd "c:\Users\uberc\LD Pro\Asset-Manager" && pnpm run dev
```

- [ ] **Step 2: Navigate to the Skills card**

Open `http://localhost:5173`, go to Admin → AI Control Plane.

- [ ] **Step 3: Test the happy path**

1. Click "Fetch from URL" (visible in Skills card header, not in preview mode)
2. Paste: `https://github.com/Paramchoudhary/ResumeSkills/blob/main/skills/resume-ats-optimizer/SKILL.md`
3. Click Fetch
4. Verify: modal closes, Add Skill editor opens with:
   - **Label** pre-filled with `resume-ats-optimizer`
   - **Display name** pre-filled with the `name:` value from that SKILL.md's frontmatter
   - **Skill body** populated with the markdown body content

- [ ] **Step 4: Test error states**

1. Enter a non-GitHub URL (e.g. `https://example.com/foo.md`) → expect "Only GitHub blob URLs are supported."
2. Enter a valid-looking but 404 URL (e.g. change the branch to `nonexistent`) → expect "HTTP 404 — check the URL and try again."
3. Clear the input and click Fetch → expect "Enter a URL."

- [ ] **Step 5: Test that preview mode hides the button**

Select a preset from the dropdown — verify "Fetch from URL" disappears from the Skills card header (same as "Add skill").
