# JD Parse Chat Subagent + AI Metrics Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JD parsing as a chat pre-processor, fix AI Metrics row editing and scope dropdown, and move AI Metrics under a renamed Settings nav group.

**Architecture:** When the user toggles "JD Parse" in the composer and sends, the API calls `parseJdText()` with the full message content before streaming — a cheap jd_parsing-scoped model extracts structured data, and the result is injected into the main model's system context. The main model then receives clean structured JD data instead of raw text and is instructed not to re-extract.

**Tech Stack:** TypeScript strict, Express 5, Zod v4, React 19, vitest, TanStack Query, Drizzle ORM, OpenRouter via `callAI()`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `artifacts/api-server/src/lib/chat/jd-parse-preprocess.ts` | `parseJdText()` — ephemeral JD extraction, no DB write |
| Create | `artifacts/api-server/src/lib/chat/__tests__/jd-parse-preprocess.test.ts` | Unit tests for `parseJdText` and `buildParsedJdBlock` |
| Modify | `artifacts/api-server/src/lib/chat/context-builder.ts` | Add `buildParsedJdBlock()` + export `ParsedJd` type |
| Modify | `artifacts/api-server/src/lib/chat/stream-openrouter.ts` | Accept `parsedJd` option, inject parsed block into system context |
| Modify | `artifacts/api-server/src/routes/chat.ts` | Accept `jdParseEnabled` in POST body, call preprocessor |
| Modify | `artifacts/dashboard/src/pages/chat/use-chat-stream.ts` | Thread `jdParseEnabled` into fetch body |
| Modify | `artifacts/dashboard/src/pages/chat/index.tsx` | JD Parse toggle button, pass flag through to stream |
| Modify | `artifacts/dashboard/src/components/navigation/floating-sidebar.tsx` | Move Models under Settings, rename Admin → Settings |
| Modify | `artifacts/dashboard/src/pages/ai-metrics/index.tsx` | Fix scope default, add row editing via `EditConfigDialog` |

---

## Task 1: Nav restructure — move Models under Settings, rename Admin

**Files:**
- Modify: `artifacts/dashboard/src/components/navigation/floating-sidebar.tsx`

- [ ] **Step 1: Update `isAiOpsActive` — remove `/ai-metrics`**

In [floating-sidebar.tsx:51-53](artifacts/dashboard/src/components/navigation/floating-sidebar.tsx#L51-L53), change:
```typescript
function isAiOpsActive(pathname: string): boolean {
  return pathname === "/ai-review" || pathname === "/ai-config" || pathname === "/ai-metrics";
}
```
to:
```typescript
function isAiOpsActive(pathname: string): boolean {
  return pathname === "/ai-review" || pathname === "/ai-config";
}
```

- [ ] **Step 2: Update `isAdminActive` — include `/ai-metrics`**

In [floating-sidebar.tsx:55-57](artifacts/dashboard/src/components/navigation/floating-sidebar.tsx#L55-L57), change:
```typescript
function isAdminActive(pathname: string): boolean {
  return pathname.startsWith("/admin/") || pathname === "/pipeline-diagram";
}
```
to:
```typescript
function isAdminActive(pathname: string): boolean {
  return pathname.startsWith("/admin/") || pathname === "/pipeline-diagram" || pathname === "/ai-metrics";
}
```

- [ ] **Step 3: Remove Models from AI ops group, add to Admin group, rename Admin → Settings**

In the JSX block that renders the AI ops CollapsibleGroup ([floating-sidebar.tsx:127-134](artifacts/dashboard/src/components/navigation/floating-sidebar.tsx#L127-L134)), remove the Models NavItem:
```tsx
<CollapsibleGroup
  icon={<Sparkles size={15} />}
  label="AI ops"
  defaultOpen={isAiOpsActive(path)}>
  <NavItem icon={<Sparkles size={15} />} label="Review queue" active={isActive("/ai-review")} href="/ai-review" indent />
  <NavItem icon={<GitCompare size={15} />} label="Prompt versions" active={isActive("/ai-config")} href="/ai-config" indent />
</CollapsibleGroup>
```

Then in the admin CollapsibleGroup ([floating-sidebar.tsx:136-149](artifacts/dashboard/src/components/navigation/floating-sidebar.tsx#L136-L149)), rename label and add Models as first item:
```tsx
{user?.role === "admin" && (
  <CollapsibleGroup
    icon={<Settings size={15} />}
    label="Settings"
    defaultOpen={isAdminActive(path)}>
    <NavItem icon={<Gamepad2 size={15} />} label="Models" active={isActive("/ai-metrics")} href="/ai-metrics" indent />
    <NavItem icon={<Users size={15} />} label="Users" active={isActive("/admin/users")} href="/admin/users" indent />
    <NavItem icon={<Key size={15} />} label="Invite codes" active={isActive("/admin/invite-codes")} href="/admin/invite-codes" indent />
    <NavItem icon={<Gauge size={15} />} label="Usage limits" active={isActive("/admin/usage-limits")} href="/admin/usage-limits" indent />
    <NavItem icon={<GitBranch size={15} />} label="Pipeline Hub" active={isActive("/pipeline-diagram")} href="/pipeline-diagram" indent />
    <NavItem icon={<ClipboardCheck size={15} />} label="Best practices" active={isActive("/admin/best-practices")} href="/admin/best-practices" indent />
    <NavItem icon={<SlidersHorizontal size={15} />} label="AI Control Plane" active={isActive("/admin/ai-control-plane")} href="/admin/ai-control-plane" indent />
    <NavItem icon={<RotateCcw size={15} />} label="Reset" active={isActive("/admin/reset")} href="/admin/reset" indent />
  </CollapsibleGroup>
)}
```

- [ ] **Step 4: Commit**
```bash
git add artifacts/dashboard/src/components/navigation/floating-sidebar.tsx
git commit -m "feat(nav): rename Admin to Settings, move Models under it"
```

---

## Task 2: AI Metrics — fix scope default + add row editing

**Files:**
- Modify: `artifacts/dashboard/src/pages/ai-metrics/index.tsx`

- [ ] **Step 1: Import `useUpdateAiModelConfig` and `Pencil` icon**

At [ai-metrics/index.tsx:1-11](artifacts/dashboard/src/pages/ai-metrics/index.tsx#L1-L11), add `useUpdateAiModelConfig` to the import from `@workspace/api-client-react` and `Pencil` to the import from `lucide-react`:
```typescript
import { Plus, Shield, X, Pencil } from "lucide-react";
import {
  useListAiModelConfigs,
  useGetModelConfigHealth,
  useGetAiPipelineOverview,
  useCreateAiModelConfig,
  useUpdateAiModelConfig,
  type AiModelConfig,
  type AiPipelineTaskSummary,
} from "@workspace/api-client-react";
```

- [ ] **Step 2: Add edit state to page, thread to ModelRow**

In `ModelsPage`, add an edit state:
```typescript
const [editingModel, setEditingModel] = useState<AiModelConfig | null>(null);
```

Pass it to `ModelRow`:
```typescript
{models.map((m) => (
  <ModelRow key={m.id} model={m} allModels={models} onEdit={setEditingModel} />
))}
```

And below the create dialog, add the edit dialog:
```tsx
{editingModel && (
  <EditConfigDialog
    model={editingModel}
    allModels={models}
    onClose={() => setEditingModel(null)}
  />
)}
```

- [ ] **Step 3: Add `onEdit` prop and edit button to `ModelRow`**

Replace the existing `ModelRow` function ([ai-metrics/index.tsx:108-132](artifacts/dashboard/src/pages/ai-metrics/index.tsx#L108-L132)):
```typescript
function ModelRow({ model, allModels, onEdit }: { model: AiModelConfig; allModels: AiModelConfig[]; onEdit: (m: AiModelConfig) => void }) {
  const fallback = allModels.find((m) => m.id === model.fallbackModelId);
  return (
    <div className="row" style={{ gridTemplateColumns: "1fr 140px 200px 200px 90px 90px 70px 32px", cursor: "default" }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{model.taskScope.replaceAll("_", " ")}</div>
        <div className="dim mono" style={{ fontSize: 11, marginTop: 2 }}>priority {model.priority}</div>
      </div>
      <span className="chip" style={{ fontSize: 11 }}>{model.provider}</span>
      <span className="mono" style={{ fontSize: 12.5, color: "var(--ink)" }}>{model.modelName}</span>
      <span className="mono dim" style={{ fontSize: 12.5 }}>
        {fallback
          ? <span title={fallback.modelName}>{fallback.modelName.split("/").pop()}</span>
          : model.fallbackModelId
            ? `#${model.fallbackModelId}`
            : <em style={{ fontFamily: "var(--font-display)" }}>none</em>}
      </span>
      <span className="mono" style={{ fontSize: 12, color: "var(--success)" }}>—</span>
      <span className="mono dim" style={{ fontSize: 12 }}>—</span>
      <span className={`chip ${model.isActive ? "success" : "ghost"} dot`} style={{ fontSize: 10.5 }}>
        {model.isActive ? "active" : "off"}
      </span>
      <button
        type="button"
        className="btn ghost"
        style={{ padding: "3px 6px" }}
        title="Edit config"
        onClick={() => onEdit(model)}
      >
        <Pencil size={12} strokeWidth={1.8} />
      </button>
    </div>
  );
}
```

Also update the header grid to match the extra column — in the header div ([ai-metrics/index.tsx:54-75](artifacts/dashboard/src/pages/ai-metrics/index.tsx#L54-L75)) change `gridTemplateColumns` from `"1fr 140px 200px 200px 90px 90px 70px"` to `"1fr 140px 200px 200px 90px 90px 70px 32px"` and add an empty `<span />` at the end.

- [ ] **Step 4: Fix scope default in `CreateConfigDialog`**

In [ai-metrics/index.tsx:148-154](artifacts/dashboard/src/pages/ai-metrics/index.tsx#L148-L154), change the initial state:
```typescript
const [form, setForm] = useState<CreateConfigForm>({
  taskScope: "",
  modelName: "",
  priority: "1",
  fallbackModelId: "",
  isActive: true,
});
```

And update the helper text below the scope input from `"Use <code>chat</code> to assign a model for the Chat page."` to:
```tsx
<div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
  e.g. <code>chat</code>, <code>jd_parsing</code>, <code>resume_tailoring</code>
</div>
```

- [ ] **Step 5: Add `EditConfigDialog` component**

Add this component after `CreateConfigDialog`:
```typescript
function EditConfigDialog({ model, allModels, onClose }: { model: AiModelConfig; allModels: AiModelConfig[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { mutateAsync: updateConfig, isPending } = useUpdateAiModelConfig();

  const [form, setForm] = useState<CreateConfigForm>({
    taskScope: model.taskScope,
    modelName: model.modelName,
    priority: String(model.priority),
    fallbackModelId: model.fallbackModelId != null ? String(model.fallbackModelId) : "",
    isActive: model.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof CreateConfigForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.taskScope.trim()) { setError("Task scope is required."); return; }
    if (!form.modelName.trim()) { setError("Model name is required."); return; }
    const priority = Number(form.priority);
    if (!Number.isFinite(priority) || priority < 1) { setError("Priority must be a positive number."); return; }

    try {
      await updateConfig({
        id: model.id,
        data: {
          taskScope: form.taskScope.trim(),
          modelName: form.modelName.trim(),
          priority,
          isActive: form.isActive,
          fallbackModelId: form.fallbackModelId ? Number(form.fallbackModelId) : null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/ai-model-configs"] });
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Failed to update config.");
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center" }}
      onClick={onClose}
    >
      <div
        style={{ width: 460, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <h2 className="card-title">Edit model config <span className="dim mono" style={{ fontSize: 12 }}>#{model.id}</span></h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label="Close"><X size={14} strokeWidth={2} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Task scope</label>
            <input className="input" value={form.taskScope} onChange={(e) => set("taskScope", e.target.value)} list="scope-suggestions-edit" />
            <datalist id="scope-suggestions-edit">
              {COMMON_SCOPES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Model name</label>
            <input className="input" value={form.modelName} onChange={(e) => set("modelName", e.target.value)} placeholder="e.g. anthropic/claude-3.5-haiku" />
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>OpenRouter model ID — find them at openrouter.ai/models</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Priority</label>
              <input className="input" type="number" min={1} value={form.priority} onChange={(e) => set("priority", e.target.value)} />
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Lower = tried first.</div>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Active</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <button
                  type="button" role="switch" aria-checked={form.isActive}
                  onClick={() => set("isActive", !form.isActive)}
                  style={{ width: 36, height: 20, borderRadius: 99, background: form.isActive ? "var(--accent)" : "var(--line)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.15s" }}
                >
                  <span style={{ position: "absolute", top: 3, left: form.isActive ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                </button>
                <span className="dim" style={{ fontSize: 12 }}>{form.isActive ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Fallback model <span className="dim" style={{ fontWeight: 400 }}>(optional)</span></label>
            <select className="input" value={form.fallbackModelId} onChange={(e) => set("fallbackModelId", e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              <option value="">— none —</option>
              {allModels.filter((m) => m.id !== model.id).map((m) => (
                <option key={m.id} value={m.id}>#{m.id} · {m.taskScope} · {m.modelName}</option>
              ))}
            </select>
          </div>

          {error && <div className="chip danger" style={{ fontSize: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary sm" disabled={isPending}>{isPending ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**
```bash
git add artifacts/dashboard/src/pages/ai-metrics/index.tsx
git commit -m "feat(ai-metrics): add row editing dialog, fix scope default to empty"
```

---

## Task 3: Backend — `ParsedJd` type + `buildParsedJdBlock` in context-builder

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/context-builder.ts`
- Create: `artifacts/api-server/src/lib/chat/__tests__/jd-parse-preprocess.test.ts` (partial — just the buildParsedJdBlock tests for now)

- [ ] **Step 1: Write the failing test for `buildParsedJdBlock`**

Create `artifacts/api-server/src/lib/chat/__tests__/jd-parse-preprocess.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildParsedJdBlock, type ParsedJd } from "../context-builder";

const sampleJd: ParsedJd = {
  requiredSkills: ["TypeScript", "React"],
  niceToHaveSkills: ["GraphQL"],
  keywords: ["distributed systems", "CI/CD"],
  senioritySignal: "senior",
  location: "San Francisco, CA",
  remoteType: "hybrid",
};

describe("buildParsedJdBlock", () => {
  it("returns a markdown block with the parsed JD fields", () => {
    const block = buildParsedJdBlock(sampleJd);
    expect(block).toContain("## Job Description (pre-parsed");
    expect(block).toContain("TypeScript");
    expect(block).toContain("GraphQL");
    expect(block).toContain("senior");
    expect(block).toContain("San Francisco");
    expect(block).toContain("do not re-extract");
  });

  it("omits fields that are null or empty arrays", () => {
    const sparse: ParsedJd = {
      requiredSkills: ["Node.js"],
      niceToHaveSkills: [],
      keywords: [],
      senioritySignal: null,
      location: null,
      remoteType: null,
    };
    const block = buildParsedJdBlock(sparse);
    expect(block).toContain("Node.js");
    expect(block).not.toContain("Nice-to-have:");
    expect(block).not.toContain("Seniority:");
    expect(block).not.toContain("Location:");
  });
});
```

- [ ] **Step 2: Run test — expect failure (function not defined)**
```bash
cd artifacts/api-server && pnpm test --reporter=verbose src/lib/chat/__tests__/jd-parse-preprocess.test.ts
```
Expected: FAIL — "buildParsedJdBlock is not a function" or import error.

- [ ] **Step 3: Add `ParsedJd` type and `buildParsedJdBlock` to `context-builder.ts`**

Append to the end of `artifacts/api-server/src/lib/chat/context-builder.ts`:
```typescript
export interface ParsedJd {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keywords: string[];
  senioritySignal: string | null;
  location: string | null;
  remoteType: string | null;
}

export function buildParsedJdBlock(jd: ParsedJd): string {
  const lines: string[] = ["## Job Description (pre-parsed — do not re-extract)"];

  if (jd.requiredSkills.length > 0) {
    lines.push(`**Required:** ${jd.requiredSkills.join(", ")}`);
  }
  if (jd.niceToHaveSkills.length > 0) {
    lines.push(`**Nice-to-have:** ${jd.niceToHaveSkills.join(", ")}`);
  }
  if (jd.keywords.length > 0) {
    lines.push(`**Keywords:** ${jd.keywords.join(", ")}`);
  }
  if (jd.senioritySignal) {
    lines.push(`**Seniority:** ${jd.senioritySignal}`);
  }
  if (jd.location) {
    lines.push(`**Location:** ${jd.location}${jd.remoteType ? ` (${jd.remoteType})` : ""}`);
  } else if (jd.remoteType) {
    lines.push(`**Remote type:** ${jd.remoteType}`);
  }

  lines.push("");
  lines.push("> Use this parsed data as the authoritative source. Do not re-extract or re-summarize the raw job posting text.");

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test — expect PASS**
```bash
cd artifacts/api-server && pnpm test --reporter=verbose src/lib/chat/__tests__/jd-parse-preprocess.test.ts
```
Expected: PASS (both tests green).

- [ ] **Step 5: Commit**
```bash
git add artifacts/api-server/src/lib/chat/context-builder.ts artifacts/api-server/src/lib/chat/__tests__/jd-parse-preprocess.test.ts
git commit -m "feat(chat): add ParsedJd type and buildParsedJdBlock to context-builder"
```

---

## Task 4: Backend — `jd-parse-preprocess.ts`

**Files:**
- Create: `artifacts/api-server/src/lib/chat/jd-parse-preprocess.ts`
- Modify: `artifacts/api-server/src/lib/chat/__tests__/jd-parse-preprocess.test.ts`

- [ ] **Step 1: Write the failing test for `parseJdText`**

Append to the existing test file `artifacts/api-server/src/lib/chat/__tests__/jd-parse-preprocess.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildParsedJdBlock, type ParsedJd } from "../context-builder";

// ... existing tests above ...

// ── parseJdText tests ─────────────────────────────────────────────────────

vi.mock("../../ai-client", () => ({
  callAI: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callAI, parseJsonResponse } from "../../ai-client";
import { parseJdText } from "../jd-parse-preprocess";

describe("parseJdText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls callAI with taskType jd_parsing and returns structured ParsedJd", async () => {
    const mockResult = { content: '{"requiredSkills":["TypeScript"],"niceToHaveSkills":[],"keywords":[],"senioritySignal":"senior","location":null,"remoteType":"remote"}' };
    vi.mocked(callAI).mockResolvedValue(mockResult as never);
    vi.mocked(parseJsonResponse).mockReturnValue({
      requiredSkills: ["TypeScript"],
      niceToHaveSkills: [],
      keywords: [],
      senioritySignal: "senior",
      location: null,
      remoteType: "remote",
    });

    const result = await parseJdText("Senior TypeScript Engineer at Acme Corp...");

    expect(callAI).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: "jd_parsing" }),
    );
    expect(result).toMatchObject({ requiredSkills: ["TypeScript"], senioritySignal: "senior" });
  });

  it("returns null when the AI response is not valid JSON", async () => {
    vi.mocked(callAI).mockResolvedValue({ content: "sorry, I cannot parse that" } as never);
    vi.mocked(parseJsonResponse).mockReturnValue(null);

    const result = await parseJdText("not a job description");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect failure (module not found)**
```bash
cd artifacts/api-server && pnpm test --reporter=verbose src/lib/chat/__tests__/jd-parse-preprocess.test.ts
```
Expected: FAIL — `parseJdText` not found.

- [ ] **Step 3: Create `jd-parse-preprocess.ts`**

Create `artifacts/api-server/src/lib/chat/jd-parse-preprocess.ts`:
```typescript
import { callAI, parseJsonResponse } from "../ai-client";
import { logger } from "../logger";
import type { ParsedJd } from "./context-builder";

const JD_SYSTEM_PROMPT = `You are an expert job description parser. Extract structured information from job descriptions.
Return ONLY valid JSON with this exact structure:
{
  "requiredSkills": ["string"],
  "niceToHaveSkills": ["string"],
  "keywords": ["string"],
  "senioritySignal": "junior|mid|senior|staff|principal|director|vp|executive|null",
  "location": "city, state/country or null",
  "remoteType": "remote|hybrid|onsite|null"
}
Be precise and conservative — only include skills explicitly mentioned.`;

export async function parseJdText(text: string): Promise<ParsedJd | null> {
  try {
    const result = await callAI({
      taskType: "jd_parsing",
      systemPrompt: JD_SYSTEM_PROMPT,
      userPrompt: `Parse this job description:\n\n${text}`,
    });
    return parseJsonResponse<ParsedJd>(result.content);
  } catch (err) {
    logger.warn({ err }, "jd-parse-preprocess: callAI failed, skipping JD parse");
    return null;
  }
}
```

- [ ] **Step 4: Run test — expect PASS**
```bash
cd artifacts/api-server && pnpm test --reporter=verbose src/lib/chat/__tests__/jd-parse-preprocess.test.ts
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**
```bash
git add artifacts/api-server/src/lib/chat/jd-parse-preprocess.ts artifacts/api-server/src/lib/chat/__tests__/jd-parse-preprocess.test.ts
git commit -m "feat(chat): add parseJdText pre-processor using jd_parsing scope"
```

---

## Task 5: Backend — thread `parsedJd` through stream + route

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/stream-openrouter.ts`
- Modify: `artifacts/api-server/src/routes/chat.ts`

- [ ] **Step 1: Add `parsedJd` to `StreamChatCompletionOptions` and inject into system context**

In `artifacts/api-server/src/lib/chat/stream-openrouter.ts`:

1. Add import at the top (after existing imports):
```typescript
import { buildParsedJdBlock, type ParsedJd } from "./context-builder";
```

2. Add `parsedJd` to `StreamChatCompletionOptions` ([stream-openrouter.ts:22-33](artifacts/api-server/src/lib/chat/stream-openrouter.ts#L22-L33)):
```typescript
export interface StreamChatCompletionOptions {
  conversationId: number;
  userId: number;
  userMessage: { content: string; attachments: MessageAttachment[] };
  res: Response;
  /** When set, uses this specific model config instead of selecting via task scope. */
  modelConfigId?: number;
  /** Pre-parsed JD from the jd-parse pre-processor. Injected into system context. */
  parsedJd?: ParsedJd | null;
  /** Allows tests to inject a fake OpenRouter client. */
  client?: { chat: { completions: { create: typeof openrouter.chat.completions.create } } };
  /** Allows tests to provide a stable runId / clock. */
  runIdOverride?: string;
}
```

3. After `const systemPrompt = await resolveChatSystemPrompt(...)` ([stream-openrouter.ts:144-147](artifacts/api-server/src/lib/chat/stream-openrouter.ts#L144-L147)), inject parsed JD:
```typescript
const systemPrompt = await resolveChatSystemPrompt({
  userMessage: userMessage.content,
  attachments: userMessage.attachments,
});

const fullSystemPrompt = opts.parsedJd
  ? `${systemPrompt}\n\n${buildParsedJdBlock(opts.parsedJd)}`
  : systemPrompt;
```

4. Update `chatMessages` to use `fullSystemPrompt` ([stream-openrouter.ts:182-185](artifacts/api-server/src/lib/chat/stream-openrouter.ts#L182-L185)):
```typescript
const chatMessages = [
  { role: "system" as const, content: fullSystemPrompt },
  ...history,
];
```

- [ ] **Step 2: Run existing tests to confirm no regression**
```bash
cd artifacts/api-server && pnpm test
```
Expected: all existing tests PASS.

- [ ] **Step 3: Add `jdParseEnabled` to `postMessageSchema` and call pre-processor in route**

In `artifacts/api-server/src/routes/chat.ts`:

1. Add import at the top (after existing imports):
```typescript
import { parseJdText } from "../lib/chat/jd-parse-preprocess";
import type { ParsedJd } from "../lib/chat/context-builder";
```

2. Update `postMessageSchema` ([chat.ts:79-83](artifacts/api-server/src/routes/chat.ts#L79-L83)):
```typescript
const postMessageSchema = z.object({
  content: z.string().min(1).max(20000),
  attachments: z.array(attachmentSchema).max(20).optional().default([]),
  modelConfigId: z.number().int().positive().optional(),
  jdParseEnabled: z.boolean().optional().default(false),
});
```

3. In the POST handler ([chat.ts:206-224](artifacts/api-server/src/routes/chat.ts#L206-L224)), add JD pre-processing before `streamChatCompletion`:
```typescript
router.post("/chat/threads/:id/messages", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = idParamSchema.safeParse(req.params);
  const body = postMessageSchema.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let parsedJd: ParsedJd | null = null;
  if (body.data.jdParseEnabled) {
    parsedJd = await parseJdText(body.data.content);
  }

  try {
    await streamChatCompletion({
      conversationId: params.data.id,
      userId,
      userMessage: {
        content: body.data.content,
        attachments: (body.data.attachments ?? []) as MessageAttachment[],
      },
      modelConfigId: body.data.modelConfigId,
      parsedJd,
      res,
    });
  } catch (err) {
    logger.error({ err, conversationId: params.data.id }, "Chat stream handler crashed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal chat stream failure" });
    } else {
      res.end();
    }
  }
});
```

- [ ] **Step 4: Run typecheck**
```bash
cd artifacts/api-server && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add artifacts/api-server/src/lib/chat/stream-openrouter.ts artifacts/api-server/src/routes/chat.ts
git commit -m "feat(chat): thread parsedJd through stream, accept jdParseEnabled in route"
```

---

## Task 6: Frontend — JD Parse toggle in composer

**Files:**
- Modify: `artifacts/dashboard/src/pages/chat/use-chat-stream.ts`
- Modify: `artifacts/dashboard/src/pages/chat/index.tsx`

- [ ] **Step 1: Add `jdParseEnabled` to `use-chat-stream.ts` `send` signature**

In [use-chat-stream.ts:44-58](artifacts/dashboard/src/pages/chat/use-chat-stream.ts#L44-L58), update the `send` function signature and fetch body:

Change signature:
```typescript
const send = useCallback(
  async (threadId: number, content: string, attachments: ChatAttachment[], modelConfigId?: number, jdParseEnabled?: boolean) => {
```

Change fetch body:
```typescript
body: JSON.stringify({ content, attachments, modelConfigId, jdParseEnabled }),
```

Also update the exported type signature for `send` ([use-chat-stream.ts:27-31](artifacts/dashboard/src/pages/chat/use-chat-stream.ts#L27-L31)):
```typescript
export function useChatStream(opts: { onDone?: () => void } = {}): {
  state: StreamingTurn;
  send: (threadId: number, content: string, attachments: ChatAttachment[], modelConfigId?: number, jdParseEnabled?: boolean) => Promise<void>;
  stop: () => void;
  reset: () => void;
}
```

- [ ] **Step 2: Add `jdParseEnabled` state to `ChatPage`**

In [chat/index.tsx:17-32](artifacts/dashboard/src/pages/chat/index.tsx#L17-L32), add state after existing attachment state:
```typescript
const [jdParseEnabled, setJdParseEnabled] = useState(false);
```

- [ ] **Step 3: Pass `jdParseEnabled` to `stream.send` in `handleSend`**

In [chat/index.tsx:129-142](artifacts/dashboard/src/pages/chat/index.tsx#L129-L142), update `handleSend`:
```typescript
async function handleSend() {
  if (!activeThread || !input.trim() || stream.state.active) return;
  const text = input.trim();
  const attachments = await buildAttachmentsPayload();
  setInput("");
  clearStagedAttachments();
  setMessages((prev) => [...prev, {
    id: -Date.now(), conversationId: activeThread.id, role: "user", content: text,
    attachments, runId: null, promptVersionId: null, modelName: null,
    promptTokens: null, completionTokens: null, createdAt: new Date().toISOString(),
  }]);
  const modelConfigId = selectedConfigId[activeThread.id];
  await stream.send(activeThread.id, text, attachments, modelConfigId, jdParseEnabled);
}
```

- [ ] **Step 4: Pass `jdParseEnabled` props to `Composer` and add toggle button**

Update the `Composer` call in JSX ([chat/index.tsx:244-262](artifacts/dashboard/src/pages/chat/index.tsx#L244-L262)) to include new props:
```tsx
<Composer
  input={input}
  setInput={setInput}
  onSend={handleSend}
  onStop={stream.stop}
  streaming={stream.state.active}
  stagedCount={stagedCount}
  attachBaseResume={attachBaseResume}
  setAttachBaseResume={setAttachBaseResume}
  attachedJobs={attachedJobs}
  setAttachedJobs={setAttachedJobs}
  attachedClaims={attachedClaims}
  setAttachedClaims={setAttachedClaims}
  attachedDocs={attachedDocs}
  setAttachedDocs={setAttachedDocs}
  onOpenJobPicker={() => setJobPickerOpen(true)}
  onOpenClaimsPicker={() => setClaimsPickerOpen(true)}
  textareaRef={composerRef}
  jdParseEnabled={jdParseEnabled}
  setJdParseEnabled={setJdParseEnabled}
/>
```

Update the `Composer` function signature ([chat/index.tsx:501-510](artifacts/dashboard/src/pages/chat/index.tsx#L501-L510)):
```typescript
function Composer({ input, setInput, onSend, onStop, streaming, stagedCount, attachBaseResume, setAttachBaseResume, attachedJobs, setAttachedJobs, attachedClaims, setAttachedClaims, attachedDocs, setAttachedDocs, onOpenJobPicker, onOpenClaimsPicker, textareaRef, jdParseEnabled, setJdParseEnabled }: {
  input: string; setInput: (v: string) => void;
  onSend: () => void; onStop: () => void; streaming: boolean; stagedCount: number;
  attachBaseResume: boolean; setAttachBaseResume: (v: boolean) => void;
  attachedJobs: Job[]; setAttachedJobs: (v: Job[]) => void;
  attachedClaims: Claim[]; setAttachedClaims: (v: Claim[]) => void;
  attachedDocs: { filename: string; contentText: string }[]; setAttachedDocs: (v: { filename: string; contentText: string }[]) => void;
  onOpenJobPicker: () => void; onOpenClaimsPicker: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  jdParseEnabled: boolean; setJdParseEnabled: (v: boolean) => void;
}) {
```

Add the "JD Parse" button in the `composer-attach-row` div ([chat/index.tsx:555-580](artifacts/dashboard/src/pages/chat/index.tsx#L555-L580)), after the File button:
```tsx
<button
  type="button"
  className={`attach-btn${jdParseEnabled ? " active" : ""}`}
  onClick={() => setJdParseEnabled(!jdParseEnabled)}
  title="Pre-parse job description with a fast model before sending"
>
  <Sparkles size={11} strokeWidth={1.8} /> JD Parse
</button>
```

- [ ] **Step 5: Show "Analyzing job description…" during pre-processing**

Update `StreamingBubble` ([chat/index.tsx:386-403](artifacts/dashboard/src/pages/chat/index.tsx#L386-L403)) to accept a `preHint` prop:
```typescript
function StreamingBubble({ text, fallbackModel, preHint }: { text: string; fallbackModel: string | null; preHint?: string }) {
  return (
    <div className="msg-ai">
      <div className="msg-ai-avatar"><Sparkles size={14} strokeWidth={1.8} /></div>
      <div className="msg-ai-body">
        {fallbackModel && (
          <div className="dim" style={{ fontSize: 11, marginBottom: 6, fontStyle: "italic" }}>
            ↩ switched to fallback: {fallbackModel}
          </div>
        )}
        <div className="msg-ai-bubble">
          {text
            ? <>{text}<span className="stream-cursor" /></>
            : <span className="dim" style={{ fontStyle: "italic" }}>{preHint ?? "thinking…"}</span>
          }
        </div>
      </div>
    </div>
  );
}
```

Update the `StreamingBubble` usage in JSX ([chat/index.tsx:237](artifacts/dashboard/src/pages/chat/index.tsx#L237)):
```tsx
{stream.state.active && (
  <StreamingBubble
    text={stream.state.text}
    fallbackModel={stream.state.fallbackModel}
    preHint={jdParseEnabled && !stream.state.text ? "Analyzing job description…" : undefined}
  />
)}
```

- [ ] **Step 6: Run typecheck**
```bash
pnpm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**
```bash
git add artifacts/dashboard/src/pages/chat/use-chat-stream.ts artifacts/dashboard/src/pages/chat/index.tsx
git commit -m "feat(chat): add JD Parse toggle button in composer, wire to stream pre-processor"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run all backend tests**
```bash
cd artifacts/api-server && pnpm test
```
Expected: all tests PASS.

- [ ] **Step 2: Run full typecheck**
```bash
pnpm run typecheck
```
Expected: no errors across entire workspace.

- [ ] **Step 3: Start dev and verify manually**
```bash
pnpm run dev
```
Open `http://localhost:5173`:
- Nav: verify "Settings" group contains Models, Users, Invite codes, etc.
- AI Metrics (`/ai-metrics`): verify all rows show a pencil edit button. Click edit → dialog opens pre-filled. Save → row updates.
- AI Metrics create dialog: verify task scope field starts empty, datalist shows all scopes.
- Chat (`/chat`): verify "JD Parse" toggle button appears in composer. Toggle on → highlighted. Paste a job description into the textarea. Send → see "Analyzing job description…" briefly before stream starts.

- [ ] **Step 4: Final commit if any fixes were needed**
```bash
git add -p
git commit -m "fix: address post-verification issues"
```
