# AI Control Plane UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UX issues on the AI Control Plane admin page: toast notifications are invisible and mislabeled; the preset workflow (live config vs. snapshot) is confusing to users; and the Skills card in preset-preview mode gives no explanation of system-wide skill scope.

**Architecture:** All changes are frontend-only. The toast fix is split between `toaster.tsx` (viewport positioning/styling) and the call-sites in `ai-control-plane/index.tsx` (wording). The preset workflow fix is label + banner text in `PresetBar` inside `ai-control-plane/index.tsx`. The skills note is a one-liner added to `SkillsCard` in the same file. No backend changes, no new components, no new files.

**Tech Stack:** React 19, TypeScript strict, Radix UI Toast primitives, CSS custom properties (`var(--card)`, `var(--line)`, etc.)

---

## Background: How the Preset System Works

Understanding this is critical to getting the labels right.

**Live config** = the row in `ai_chat_lever_config`. The Identity, Skills, Best Practices, and Routing cards all read from and write to this row. Pressing "Save" on the Identity card updates the live config immediately.

**Preset** = a named snapshot of the live config at a point in time (`ai_chat_lever_presets`). It does NOT sync automatically.

**The three preset actions:**
- **Apply** → copies the preset snapshot into the live config (preset → live)
- **Save current as preset** (camera icon) → snapshots current live config into a new preset row (live → new preset)
- **Update** (currently mislabeled) → re-snapshots current live config into the *selected existing* preset (live → overwrites existing preset)

**The workflow the user is missing:**
When previewing Preset B, the Identity card is **read-only** (Save button hidden). To get identity text into Preset B's snapshot:
1. Clear the preview (click "— select a preset —" or "Clear")
2. Edit the Identity card and click Save → live config updated
3. Select Preset B from the dropdown
4. Click "Update" (to be renamed) → live state is snapshotted into B

The user thought clicking "Save" on the Identity card while previewing B would update B's snapshot. It doesn't — and there's no banner explaining this.

---

## Files

| File | Changes |
|------|---------|
| `artifacts/dashboard/src/components/ui/toaster.tsx` | Style the viewport (fixed position, bottom-right) and toast items (card appearance, no list markers) |
| `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx` | Fix 4 toast titles; rename "Update" button; rewrite preview banner; add skills-scope note in preview mode |

---

## Task 1: Fix Toast Viewport Positioning and Appearance

**Problem:** `ToastViewport` renders as an unstyled Radix `<ol>`. Without CSS it appears in document flow at the bottom-left, with browser default list numbering ("1. Identity updated"). The app has no toast CSS — every notification is invisible in practice.

**Files:**
- Modify: `artifacts/dashboard/src/components/ui/toaster.tsx`

- [ ] **Step 1: Add viewport and item styles in toaster.tsx**

Replace the entire file content:

```tsx
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDestructive = variant === "destructive";
        return (
          <Toast
            key={id}
            variant={variant}
            {...props}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "10px 14px",
              background: isDestructive ? "var(--danger-bg, #fff0f0)" : "var(--card)",
              border: `1px solid ${isDestructive ? "var(--danger, #d73a49)" : "var(--line)"}`,
              borderRadius: "var(--r-lg, 8px)",
              boxShadow: "var(--shadow-pop)",
              fontSize: 13,
              minWidth: 220,
              maxWidth: 340,
              cursor: "default",
            }}
          >
            <div style={{ flex: 1 }}>
              {title && (
                <ToastTitle style={{ fontWeight: 600, fontSize: 13, color: isDestructive ? "var(--danger, #d73a49)" : "var(--ink)" }}>
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose
              style={{
                position: "absolute", top: 6, right: 8,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 16, color: "var(--ink-4)", lineHeight: 1,
              }}
            >
              ×
            </ToastClose>
          </Toast>
        );
      })}
      <ToastViewport
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          listStyle: "none",
          padding: 0,
          margin: 0,
          outline: "none",
          width: 340,
        }}
      />
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```powershell
pnpm run typecheck
```

Expected: no new errors. (Pre-existing errors are documented in project state — don't fix those here.)

- [ ] **Step 3: Commit**

```powershell
git add artifacts/dashboard/src/components/ui/toaster.tsx
git commit -m "fix(toast): position fixed bottom-right, card styling, suppress list markers"
```

---

## Task 2: Fix Toast Wording on the AI Control Plane

**Problem:** Four toast messages either mismatch the action that triggered them or are too verbose.

| Current | Triggered by | Fixed |
|---------|-------------|-------|
| `"Identity updated"` | Clicking Save on Identity card | `"Identity saved"` |
| `"Best practices lever updated"` | Toggling the best practices switch | `"Best practices updated"` |
| `"Preset saved"` (via `onSaved`) | Also fires when creating a preset via New Preset modal | Keep for "Save current as preset"; add distinct toast for template creation |
| `"Preset updated"` | Clicking the Update (soon to be renamed) button | Will remain `"Preset updated"` — fine once button is renamed in Task 3 |

The `handleCreated` function currently calls `onSaved()` which fires `"Preset saved"`. This is the right text for "Save current as preset" but should be `"Preset created"` for new-from-template. Fix: remove the toast from `onSaved` and put distinct toasts directly in `handleSave` and `handleCreated`.

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx`

- [ ] **Step 1: Move preset-save toast from parent callback into PresetBar callers, fix other titles**

In `AiControlPlanePage` (around line 109-130), change the two callbacks:

```tsx
// BEFORE
onSaved={() => { invalidateAll(); toast({ title: "Preset saved" }); }}
// ...
onSaved={() => { invalidateAll(); toast({ title: "Identity updated" }); }}
// ...
onChanged={() => { invalidateAll(); toast({ title: "Best practices lever updated" }); }}
```

```tsx
// AFTER
onSaved={() => { invalidateAll(); }}          // toast moved into PresetBar callers
// ...
onSaved={() => { invalidateAll(); toast({ title: "Identity saved" }); }}
// ...
onChanged={() => { invalidateAll(); toast({ title: "Best practices updated" }); }}
```

Full corrected block at lines 104–135:

```tsx
<PresetBar
  presets={presets}
  promptVersions={promptVersions}
  previewPreset={previewPreset}
  onPreviewChange={setPreviewPreset}
  onApplied={() => { setPreviewPreset(null); invalidateAll(); toast({ title: "Preset applied" }); }}
  onSaved={() => { invalidateAll(); }}
  onDeleted={() => { setPreviewPreset(null); invalidateAll(); toast({ title: "Preset deleted" }); }}
  onUpdated={() => { invalidateAll(); }}
/>
<IdentityCard
  identityText={displayed.identityText}
  isPreview={!!previewPreset}
  onSaved={() => { invalidateAll(); toast({ title: "Identity saved" }); }}
/>
<SkillsCard
  skillsEnabled={displayed.skillsEnabled}
  promptVersions={promptVersions}
  previewActiveIds={previewPreset?.snapshot.activePromptVersionIds ?? null}
  isPreview={!!previewPreset}
  onChanged={() => { invalidateAll(); }}
/>
<BestPracticesCard
  bestPracticesEnabled={displayed.bestPracticesEnabled}
  isPreview={!!previewPreset}
  onChanged={() => { invalidateAll(); toast({ title: "Best practices updated" }); }}
/>
<RoutingCard
  skillRoutingMode={displayed.skillRoutingMode}
  isPreview={!!previewPreset}
  onChanged={() => { invalidateAll(); }}
/>
```

- [ ] **Step 2: Add distinct toasts in handleSave and handleCreated inside PresetBar**

Find `handleSave` (the "Save current as preset" handler):

```tsx
// BEFORE
async function handleSave() {
  if (!newName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
  try {
    await create.mutateAsync({ data: { name: newName.trim() } });
    setNewName(""); setSaveOpen(false); onSaved();
  } catch (err) { toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" }); }
}
```

```tsx
// AFTER
async function handleSave() {
  if (!newName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
  try {
    await create.mutateAsync({ data: { name: newName.trim() } });
    setNewName(""); setSaveOpen(false);
    onSaved();
    toast({ title: "Preset saved" });
  } catch (err) { toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" }); }
}
```

Find `handleCreated`:

```tsx
// BEFORE
function handleCreated(created: ChatLeverPreset) {
  setNewPresetOpen(false);
  setSelectedId(created.id);
  onPreviewChange(created);
  onSaved();
}
```

```tsx
// AFTER
function handleCreated(created: ChatLeverPreset) {
  setNewPresetOpen(false);
  setSelectedId(created.id);
  onPreviewChange(created);
  onSaved();
  toast({ title: "Preset created" });
}
```

- [ ] **Step 3: Typecheck**

```powershell
pnpm run typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
git add artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx
git commit -m "fix(control-plane): correct toast wording for identity save, best practices, preset create vs save"
```

---

## Task 3: Rename "Update" Button and Rewrite Preview Banner

**Problem:** The "Update" button re-snapshots the current **live** state into the selected preset (live → overwrites preset). The label "Update" gives no directional hint. The preview banner says only "Click Apply to make this the live config" — it doesn't tell the user that editing the cards below changes the **live** config, not the preset. Users end up editing the live Identity text, expecting it to go into the preset.

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx`

- [ ] **Step 1: Rename the Update button and add a directional tooltip**

Find the "Update" button (in `PresetBar`, inside the first `<div>` of the return):

```tsx
// BEFORE
<button type="button" className="btn ghost sm" disabled={selectedId === "" || updating} onClick={handleUpdate}>
  <Save size={12} strokeWidth={1.8} /> {updating ? "Saving…" : "Update"}
</button>
```

```tsx
// AFTER — "Overwrite" clearly signals direction: live config → this preset
<button
  type="button"
  className="btn ghost sm"
  disabled={selectedId === "" || updating}
  onClick={handleUpdate}
  title="Re-snapshot the current live state into this preset"
>
  <Save size={12} strokeWidth={1.8} /> {updating ? "Saving…" : "Overwrite"}
</button>
```

Also update the toast in `handleUpdate` to match:

```tsx
// BEFORE (inside handleUpdate's try block)
toast({ title: "Preset updated" });
```

```tsx
// AFTER
toast({ title: "Preset overwritten" });
```

- [ ] **Step 2: Rewrite the preview banner**

Find the `previewPreset && (...)` banner block in `PresetBar`'s return (the light-blue info strip):

```tsx
// BEFORE
<span>Previewing <strong>{previewPreset.name}</strong> — values shown below. Click <strong>Apply</strong> to make this the live config.</span>
```

```tsx
// AFTER — two sentences: what preview shows, and what editing + Overwrite does
<span style={{ lineHeight: 1.5 }}>
  Previewing <strong>{previewPreset.name}</strong>.{" "}
  Cards below show this preset's values — editing them updates the{" "}
  <em>live config</em>, not the preset. To save live edits back into this preset, click{" "}
  <strong>Overwrite</strong>.
</span>
```

- [ ] **Step 3: Typecheck**

```powershell
pnpm run typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
git add artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx
git commit -m "fix(control-plane): rename Update→Overwrite, clarify preview banner re live vs preset"
```

---

## Task 4: Add Skills Scope Note in Preview Mode

**Problem:** When previewing a preset, the Skills card lists all system skills with their preset-controlled active state. Delete buttons are hidden (correct — deleting a skill removes it system-wide, not just from the preset). Users see the skills listed and assume they belong to the preset specifically, or try to delete them.

**Fix:** Add a one-line note inside `SkillsCard` when `isPreview` is true, above the skills list, explaining that skills are system-wide and the preset controls which are active.

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx`

- [ ] **Step 1: Add the note inside SkillsCard**

Find the main skills container div in `SkillsCard` (around line 446):

```tsx
// BEFORE
<div style={{ opacity: skillsEnabled ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 8 }}>
  {skills.length === 0 && (
    <div className="dim" style={{ fontSize: 12.5, textAlign: "center", padding: "8px 0" }}>
      No chat skills yet. Add one or run the chat seed.
    </div>
  )}
  {skills.map((v) => {
```

```tsx
// AFTER
<div style={{ opacity: skillsEnabled ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 8 }}>
  {isPreview && skills.length > 0 && (
    <div className="dim" style={{ fontSize: 11.5, padding: "4px 2px" }}>
      Skills are system-wide. This preset controls which ones are active — toggles are disabled in preview mode.
    </div>
  )}
  {skills.length === 0 && (
    <div className="dim" style={{ fontSize: 12.5, textAlign: "center", padding: "8px 0" }}>
      No chat skills yet. Add one or run the chat seed.
    </div>
  )}
  {skills.map((v) => {
```

- [ ] **Step 2: Typecheck**

```powershell
pnpm run typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
git add artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx
git commit -m "fix(control-plane): add skills scope note in preset preview mode"
```

---

## Task 5: Manual Verification

No automated test coverage exists for these UI changes. Do this by hand after all four tasks are committed.

- [ ] **Step 1: Start the dev server**

```powershell
pnpm run dev
```

Open `http://localhost:5173/admin/ai-control-plane` while logged in as admin.

- [ ] **Step 2: Verify toast positioning**

Click Save on the Identity card (edit any character and save). Confirm:
- A toast appears **bottom-right**, over the layout
- It looks like a card (border, background), no number prefix
- It reads "Identity saved" (not "Identity updated")

- [ ] **Step 3: Verify preset create vs save wording**

Click "New preset", fill in a name, click "Create preset". Confirm toast says "Preset created".

Click "Save current as preset" (camera icon). Confirm toast says "Preset saved".

- [ ] **Step 4: Verify preview banner and Overwrite flow**

1. Select any preset from the dropdown.
2. Confirm the banner now reads the two-sentence version ending in "click **Overwrite**".
3. Clear preview (click "— select a preset —").
4. Edit the Identity text, click Save → toast "Identity saved".
5. Select the preset again → Identity card is read-only.
6. Click **Overwrite** → toast "Preset overwritten". Preset's snapshot now includes the new identity text.
7. Deselect and reselect the preset → identity text persists.

- [ ] **Step 5: Verify skills note in preview**

Select a preset. In the Skills card, confirm the grey note appears: "Skills are system-wide. This preset controls which ones are active…"

Confirm no delete buttons are visible and the note explains why.
