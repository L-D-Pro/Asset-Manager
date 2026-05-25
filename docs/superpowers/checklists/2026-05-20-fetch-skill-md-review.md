# Fetch Skill from GitHub — Review Checklist

## Task 1: Pure Helper Functions

### Code Correctness
- [ ] `toRawUrl()` correctly transforms `github.com/user/repo/blob/branch/path/SKILL.md` → `raw.githubusercontent.com/user/repo/branch/path/SKILL.md`
- [ ] `toRawUrl()` returns `null` for non-GitHub URLs (non-matching input)
- [ ] `extractLabelFromUrl()` extracts repo name from URL path correctly
- [ ] `parseSkillMd()` extracts `name:` from YAML frontmatter
- [ ] `parseSkillMd()` extracts body text after `---` separator
- [ ] `parseSkillMd()` returns `{ name: string; body: string }` object

### TypeScript Type Safety
- [ ] All functions have explicit return types (`string | null` or `{ name: string; body: string }`)
- [ ] No `any` types used
- [ ] Regex patterns are properly typed

### TypeScript Verification
```
corepack pnpm run typecheck
```
- [ ] Zero TypeScript errors

## Task 2: SkillEditorModal `prefill` Prop

### Code Correctness
- [ ] `prefill?: { name: string; body: string }` added to component props interface
- [ ] `prefill?.name` populates the name input on mount
- [ ] `prefill?.body` populates the textarea on mount
- [ ] Prefill values are applied only on initial render (not on re-renders)
- [ ] Existing behavior is preserved when `prefill` is not provided

### TypeScript Verification
- [ ] Zero TypeScript errors after adding prop

## Task 3: FetchSkillModal Component

### Code Correctness
- [ ] Modal renders as a Portal overlay
- [ ] URL input field accepts GitHub URLs
- [ ] "Fetch" button is disabled when URL is empty
- [ ] "Fetch" button shows loading state during fetch
- [ ] Success state shows preview with name + body + "Insert" button
- [ ] Error state shows fetch error message with "Retry" button
- [ ] "Cancel" button closes modal without side effects
- [ ] "Insert" button calls `onInsert` with parsed data
- [ ] Inline styles match dashboard design tokens

### TypeScript Verification
- [ ] Zero TypeScript errors

## Task 4: SkillsCard Wiring

### Code Correctness
- [ ] `fetchOpen` state controls FetchSkillModal visibility
- [ ] `prefillData` state holds parsed skill data for prefill
- [ ] "Fetch from URL" button is visible when `!isPreview`
- [ ] "Fetch from URL" button is hidden when `isPreview`
- [ ] Button click sets `fetchOpen(true)`
- [ ] `onInsert` handler sets `prefillData` and `fetchOpen(false)`
- [ ] `FetchSkillModal` renders with correct props when `fetchOpen`
- [ ] `SkillEditorModal` receives `prefill={prefillData}` when adding new skill
- [ ] Inline styles match existing button styles in the component

### Preview Mode Behavior
- [ ] In preview mode, "Fetch from URL" button does NOT appear
- [ ] In preview mode, existing skill toggle/edit behavior is unchanged

### TypeScript Verification
- [ ] Zero TypeScript errors

## Task 5: Manual Verification

### Happy Path
1. [ ] Start dev server: `corepack pnpm run dev`
2. [ ] Navigate to AI Control Plane → Skills section
3. [ ] Click "Fetch from URL" button
4. [ ] Paste valid GitHub SKILL.md URL (e.g., `https://github.com/anthropics/claude-code/blob/main/SKILL.md`)
5. [ ] Click "Fetch" — modal shows preview with name + body
6. [ ] Click "Insert" — SkillEditorModal opens with pre-filled data
7. [ ] Save the skill — it appears in the skills list

### Error States
1. [ ] Empty URL input — "Fetch" button is disabled
2. [ ] Invalid GitHub URL — error message shown, "Retry" available
3. [ ] 404 response (non-existent file) — error message shown
4. [ ] Cancel button — modal closes, no side effects

### Preview Mode
1. [ ] Switch to preview mode — "Fetch from URL" button is hidden
2. [ ] Existing skills display is unchanged

### TypeScript Verification
- [ ] `corepack pnpm run typecheck` — zero errors

### Build Verification
- [ ] `corepack pnpm --filter @workspace/api-server run build` — succeeds
- [ ] `corepack pnpm --filter @workspace/dashboard run build` — succeeds

## Commit Hygiene

- [ ] Task 1: `feat(dashboard): add helper functions for GitHub URL transform and SKILL.md parsing`
- [ ] Task 2: `feat(dashboard): add prefill prop to SkillEditorModal`
- [ ] Task 3: `feat(dashboard): add FetchSkillModal component`
- [ ] Task 4: `feat(dashboard): wire fetch flow into SkillsCard`
- [ ] Each commit is atomic and builds cleanly (typecheck passes)
