import { useState } from "react";

const STEPS = [
  {
    num: 1,
    id: "intake",
    label: "Intake",
    color: "from-sky-500 to-blue-600",
    badge: "bg-blue-100 text-blue-800",
    ring: "ring-blue-300",
    icon: "📋",
    userAction: "Enter job title, company, location, URL, and paste the raw job description text.",
    routes: ["POST /api/jobs"],
    routeDetail: ["Creates a new job record with raw JD text and metadata."],
    ai: null,
    stores: ["jobs (title, company, raw_jd_text, status: 'active')"],
    storeColor: "bg-blue-50 text-blue-700",
  },
  {
    num: 2,
    id: "parse",
    label: "JD Parse",
    color: "from-violet-500 to-purple-600",
    badge: "bg-purple-100 text-purple-800",
    ring: "ring-purple-300",
    icon: "🔍",
    userAction: "Review parsed skills, requirements and metadata. Edit anything the AI got wrong.",
    routes: ["POST /api/jobs/:id/parse", "PATCH /api/jobs/:id"],
    routeDetail: [
      "Triggers AI extraction of skills, responsibilities, keywords, salary, remote status.",
      "Saves user edits to parsed data.",
    ],
    ai: {
      pipeline: "jd-parse.ts",
      model: "claude-3.5-haiku (jd_parsing scope)",
      tokens: "~1 000 prompt / ~400 completion",
      input: "Raw JD text",
      output: "Structured JSON: required_skills[], nice_to_have[], responsibilities[], keywords[], salary, location, remote",
      validation: "JSON schema validation — invalid shape triggers error 422",
    },
    stores: ["jobs.parsed_structured_data (JSON)", "jobs.status → 'parsed'"],
    storeColor: "bg-purple-50 text-purple-700",
  },
  {
    num: 3,
    id: "role",
    label: "Role Profile",
    color: "from-teal-500 to-emerald-600",
    badge: "bg-teal-100 text-teal-800",
    ring: "ring-teal-300",
    icon: "🎯",
    userAction: "Pick a Role Profile (target job type). Optionally generate new Claims from notes. Select which Claims to use for tailoring.",
    routes: [
      "GET /api/role-profiles",
      "POST /api/role-profiles",
      "GET /api/jobs/:id/claim-matches",
      "POST /api/claims/draft",
      "POST /api/claims",
      "PATCH /api/jobs/:id",
    ],
    routeDetail: [
      "Load existing role profiles.",
      "Create a new role profile.",
      "Score claims against parsed JD via keyword/skill matching.",
      "AI drafts new claims from raw user notes.",
      "Save approved claim drafts.",
      "Attach role profile to the job.",
    ],
    ai: {
      pipeline: "claim-generation.ts",
      model: "claude-3.5-haiku (claim_generation scope)",
      tokens: "~2 200 prompt / ~900 completion",
      input: "User notes / experience text",
      output: "Array of structured claims: summary, evidence, phrasing_variants[], applicable_tags[], disallowed_implications[]",
      validation: "Output reviewed by user before saving; no auto-approve",
    },
    stores: [
      "role_profiles (label, target_titles[], target_skills[])",
      "claims (summary, evidence, evidence_type, phrasing_variants, applicable_tags)",
      "jobs.role_profile_id",
    ],
    storeColor: "bg-teal-50 text-teal-700",
  },
  {
    num: 4,
    id: "tailor",
    label: "Tailor",
    color: "from-orange-500 to-amber-600",
    badge: "bg-amber-100 text-amber-800",
    ring: "ring-amber-300",
    icon: "✂️",
    userAction: "Choose a resume template. Click Generate. Optionally run Comparison Mode to test multiple AI models side-by-side.",
    routes: [
      "POST /api/jobs/:id/tailor",
      "POST /api/jobs/:id/cover-letter",
      "POST /api/jobs/:id/compare/resume",
    ],
    routeDetail: [
      "Runs full resume tailoring pipeline with selected claims + base resume.",
      "Runs cover letter drafting pipeline.",
      "Bulk-generates multiple resume versions for A/B comparison.",
    ],
    ai: {
      pipeline: "resume-tailor.ts + cover-letter-draft.ts",
      model: "claude-3.5-haiku → gpt-4o-mini fallback (per scope)",
      tokens: "Resume: ~3 500 prompt / ~1 500 completion | Cover letter: ~1 400 prompt / ~750 completion",
      input: "Base resume + selected claims + parsed JD + job research + best-practices config",
      output: "Resume: plain-text with [src:claim:N] / [src:base:section:bNNN] tags on every line | Cover letter: structured JSON paragraphs with claimIds[]",
      validation: "Source-tag validation (Truth Lock) + section coverage check + word-count check",
    },
    stores: [
      "resume_versions (tailored_document_text, diff_data, source_validation, run_id, status: 'pending_approval')",
      "cover_letter_versions (paragraphs JSON, full_text, status: 'pending_approval')",
      "event_logs (model, tokens, run_id, outcome)",
    ],
    storeColor: "bg-amber-50 text-amber-700",
  },
  {
    num: 5,
    id: "approve",
    label: "Approve",
    color: "from-green-500 to-emerald-600",
    badge: "bg-green-100 text-green-800",
    ring: "ring-green-300",
    icon: "✅",
    userAction: "Read the AI draft. Check source attributions and Truth Review warnings. Approve or reject the resume and cover letter.",
    routes: [
      "GET /api/resume-versions/:id",
      "POST /api/resume-versions/:id/approve",
      "POST /api/resume-versions/:id/reject",
      "GET /api/cover-letter-versions/:id",
      "POST /api/cover-letter-versions/:id/approve",
    ],
    routeDetail: [
      "Load resume version with diff data and source map.",
      "Mark resume as approved — locks it for submission.",
      "Reject and regenerate.",
      "Load cover letter version with paragraph breakdown.",
      "Mark cover letter as approved.",
    ],
    ai: null,
    stores: [
      "resume_versions.status → 'approved'",
      "cover_letter_versions.status → 'approved'",
      "ai_training_examples (if approved output meets quality bar — fed back into few-shot pool)",
    ],
    storeColor: "bg-green-50 text-green-700",
  },
  {
    num: 6,
    id: "apply",
    label: "Apply",
    color: "from-indigo-500 to-violet-600",
    badge: "bg-indigo-100 text-indigo-800",
    ring: "ring-indigo-300",
    icon: "🚀",
    userAction: "Log the application submission. Track status (applied, interview, offer, rejected).",
    routes: ["POST /api/assisted-apply/sessions", "PATCH /api/jobs/:id"],
    routeDetail: [
      "Creates an assisted-apply session linking the approved resume + cover letter versions.",
      "Updates job status to 'applied'.",
    ],
    ai: null,
    stores: [
      "assisted_apply_sessions (resume_version_id, cover_letter_version_id, status)",
      "jobs.status → 'applied'",
    ],
    storeColor: "bg-indigo-50 text-indigo-700",
  },
];

const TRUTH_LOCK_STEPS = [
  {
    label: "Build Source Packet",
    color: "bg-amber-100 border-amber-300",
    detail:
      "Parses base resume into labeled snippets (base:section:bNNN). Merges with selected claims (claim:N). Formats as prompt context.",
    file: "resume-source-packet.ts → buildResumeSourcePacket()",
  },
  {
    label: "AI Draft (tagged)",
    color: "bg-purple-100 border-purple-300",
    detail:
      "Model writes every content line ending with [src:claim:N] or [src:base:section:bNNN]. Attempt 1: haiku. Attempt 2: gpt-4o-mini fallback.",
    file: "resume-tailor.ts → callAI()",
  },
  {
    label: "Parse + Validate Tags",
    color: "bg-rose-100 border-rose-300",
    detail:
      "Extracts all [src:...] refs. Validates each ref exists in the packet. Counts valid / invalid / source-less lines. Runs section coverage check.",
    file: "resume-source-packet.ts → parsePlainTextResumeDraft()",
  },
  {
    label: "Ensure Coverage",
    color: "bg-teal-100 border-teal-300",
    detail:
      "If AI skipped sections or produced < MIN_ITEMS, fills gaps deterministically from base resume sources ranked by relevance score.",
    file: "resume-tailor.ts → ensureSectionCoverage()",
  },
  {
    label: "Render via Template",
    color: "bg-blue-100 border-blue-300",
    detail:
      "Validated items are rendered through the selected ATS template (software developer, instructional designer, etc.) into final document text.",
    file: "resume-templates.ts → renderResumePlainText()",
  },
  {
    label: "Store + Surface Warnings",
    color: "bg-green-100 border-green-300",
    detail:
      "Saves version with status 'pending_approval'. Source validation report and Truth Review warnings surfaced to user in the Approve step.",
    file: "resume-tailor.ts → saveResumeVersion()",
  },
];

const FALLBACK_CHAIN = [
  { label: "Attempt 1", sub: "claude-3.5-haiku", color: "bg-purple-500", outcome: "Full tagged resume draft" },
  { label: "Attempt 2", sub: "gpt-4o-mini", color: "bg-blue-500", outcome: "Retry if Attempt 1 fails or returns empty" },
  {
    label: "Deterministic Fallback",
    sub: "No AI",
    color: "bg-slate-500",
    outcome: "Assembles resume from base-resume snippets only — always produces a usable draft",
  },
];

const SCOPES = [
  { scope: "resume_tailoring", primary: "claude-3.5-haiku", fallback: "gpt-4o-mini", timeout: "35 s", tokens: "4 000" },
  { scope: "cover_letter", primary: "claude-3.5-haiku", fallback: "gpt-4o-mini", timeout: "30 s", tokens: "3 000" },
  { scope: "claim_generation", primary: "claude-3.5-haiku", fallback: "—", timeout: "25 s", tokens: "1 800" },
  { scope: "jd_parsing", primary: "claude-3.5-haiku", fallback: "—", timeout: "60 s", tokens: "8 192" },
  { scope: "default", primary: "claude-3.5-haiku", fallback: "—", timeout: "30 s", tokens: "2 000" },
];

export default function PipelineDiagram() {
  const [activeStep, setActiveStep] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Hero */}
      <div className="border-b border-slate-800 px-8 py-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🧠</span>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400 border border-slate-700 rounded px-2 py-0.5">
              Internal Reference
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">AI Tailoring Pipeline</h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            End-to-end flow from raw job posting to approved, Truth-Lock validated application materials. Click any step
            for detail.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-16">
        {/* ── Wizard Steps ── */}
        <section>
          <SectionLabel>Wizard Pipeline · 6 Steps</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 mt-4">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex lg:flex-col items-stretch gap-0">
                <StepCard
                  step={step}
                  isActive={activeStep === step.id}
                  onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                />
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:flex justify-center items-start pt-6 -mr-1.5 -ml-1.5 z-10">
                    <span className="text-slate-600 text-xl">›</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Expanded Detail Panel */}
          {activeStep && (() => {
            const s = STEPS.find((s) => s.id === activeStep)!;
            return (
              <div className={`mt-4 rounded-xl border p-6 ring-1 ${s.ring} bg-slate-900 animate-in fade-in slide-in-from-top-2 duration-200`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{s.icon}</span>
                  <h3 className="text-xl font-bold text-white">
                    Step {s.num}: {s.label}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <DetailBox label="User Action" icon="👤" color="bg-slate-800">
                    {s.userAction}
                  </DetailBox>
                  <DetailBox label="API Routes" icon="⚡" color="bg-slate-800" mono>
                    {s.routes.map((r, i) => (
                      <div key={r} className="mb-1">
                        <span className="text-amber-400">{r}</span>
                        {s.routeDetail[i] && (
                          <span className="text-slate-400 text-xs block pl-1">↳ {s.routeDetail[i]}</span>
                        )}
                      </div>
                    ))}
                  </DetailBox>
                  {s.ai ? (
                    <DetailBox label="AI Pipeline" icon="🤖" color="bg-slate-800">
                      <div className="space-y-1">
                        <Row k="File" v={s.ai.pipeline} mono />
                        <Row k="Model" v={s.ai.model} />
                        <Row k="Tokens" v={s.ai.tokens} mono />
                        <Row k="Input" v={s.ai.input} />
                        <Row k="Output" v={s.ai.output} />
                        <Row k="Validation" v={s.ai.validation} />
                      </div>
                    </DetailBox>
                  ) : (
                    <DetailBox label="AI Pipeline" icon="🤖" color="bg-slate-800">
                      <span className="text-slate-500 italic">No AI call at this step</span>
                    </DetailBox>
                  )}
                  <DetailBox label="Data Stored" icon="🗄️" color="bg-slate-800" mono>
                    {s.stores.map((r) => (
                      <div key={r} className="text-emerald-400 mb-1">
                        {r}
                      </div>
                    ))}
                  </DetailBox>
                </div>
              </div>
            );
          })()}
        </section>

        {/* ── Swimlane Overview ── */}
        <section>
          <SectionLabel>Data Flow · Swimlane View</SectionLabel>
          <div className="mt-4 rounded-xl border border-slate-800 overflow-hidden text-sm">
            <SwimRow lane="User" color="bg-slate-800" icon="👤">
              {["Paste JD", "Review parse", "Pick claims", "Choose template", "Read + approve", "Submit app"].map((t) => (
                <SwimCell key={t} text={t} color="bg-slate-700" />
              ))}
            </SwimRow>
            <SwimRow lane="Frontend" color="bg-slate-800/60" icon="🖥️">
              {["/apply-wizard step 1", "step 2", "step 3", "step 4 · Tailor", "step 5 · Approve", "step 6 · Apply"].map((t) => (
                <SwimCell key={t} text={t} color="bg-slate-700/70" />
              ))}
            </SwimRow>
            <SwimRow lane="API Server" color="bg-slate-800" icon="⚡">
              {[
                "POST /api/jobs",
                "POST /api/jobs/:id/parse",
                "GET claim-matches\nPOST claims/draft",
                "POST /tailor\nPOST /cover-letter",
                "POST .../approve",
                "POST assisted-apply",
              ].map((t) => (
                <SwimCell key={t} text={t} color="bg-amber-950/50" textColor="text-amber-300" mono />
              ))}
            </SwimRow>
            <SwimRow lane="AI Engine" color="bg-slate-800/60" icon="🤖">
              {["—", "jd-parse.ts\nhaiku", "claim-generation.ts\nhaiku", "resume-tailor.ts\ncover-letter-draft.ts", "—", "—"].map((t) => (
                <SwimCell key={t} text={t} color="bg-purple-950/50" textColor="text-purple-300" />
              ))}
            </SwimRow>
            <SwimRow lane="Database" color="bg-slate-800" icon="🗄️" last>
              {["jobs row", "jobs.parsed_structured_data", "claims\nrole_profiles", "resume_versions\ncover_letter_versions\nevent_logs", "status → approved\ntraining_examples", "assisted_apply_sessions"].map((t) => (
                <SwimCell key={t} text={t} color="bg-emerald-950/50" textColor="text-emerald-300" />
              ))}
            </SwimRow>
          </div>
        </section>

        {/* ── Truth Lock ── */}
        <section>
          <SectionLabel>Truth-Lock Validation · Resume Tailoring Deep Dive</SectionLabel>
          <p className="text-slate-400 text-sm mt-1 mb-4">
            Runs inside <span className="font-mono text-amber-400">POST /api/jobs/:id/tailor</span>. Ensures every fact in the
            AI output is traceable to a verified source.
          </p>
          <div className="flex flex-col md:flex-row gap-0">
            {TRUTH_LOCK_STEPS.map((s, i) => (
              <div key={s.label} className="flex md:flex-col items-center flex-1 gap-0">
                <div className={`rounded-xl border p-4 flex-1 w-full ${s.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-white/60 text-slate-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-slate-800 text-sm">{s.label}</span>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed mb-2">{s.detail}</p>
                  <span className="font-mono text-xs text-slate-500">{s.file}</span>
                </div>
                {i < TRUTH_LOCK_STEPS.length - 1 && (
                  <div className="text-slate-500 text-xl px-1 hidden md:block">›</div>
                )}
              </div>
            ))}
          </div>

          {/* Validation outcomes */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <OutcomeBox
              icon="✅"
              label="All tags valid"
              color="bg-emerald-950 border-emerald-800"
              desc="Every content line has at least one [src:...] ref that matches the source packet. AI draft is used directly, rendered through the template."
            />
            <OutcomeBox
              icon="⚠️"
              label="Partial tag failure"
              color="bg-amber-950 border-amber-800"
              desc="Some lines missing tags. ensureSectionCoverage() fills gaps from base-resume sources. Result is a hybrid AI + deterministic draft. Warnings surfaced in Approve step."
            />
            <OutcomeBox
              icon="🔁"
              label="Total tag failure (fallback)"
              color="bg-rose-950 border-rose-800"
              desc="AI returned 0 valid tags (e.g. skipped tagging entirely). Full deterministic fallback: resume assembled from ranked base-resume snippets only. Stored with warning note."
            />
          </div>
        </section>

        {/* ── Model Chain ── */}
        <section>
          <SectionLabel>Model Configuration · Per-Scope Chains</SectionLabel>
          <p className="text-slate-400 text-sm mt-1 mb-4">
            Configured in the database via the AI Config page. <span className="font-mono text-amber-400">resolveModelChain()</span>{" "}
            picks the active chain per scope at runtime. Health checks run on startup + every 5 min.
          </p>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Scope</th>
                  <th className="text-left px-4 py-3">Primary Model</th>
                  <th className="text-left px-4 py-3">Fallback</th>
                  <th className="text-left px-4 py-3">Timeout</th>
                  <th className="text-left px-4 py-3">Max Tokens</th>
                </tr>
              </thead>
              <tbody>
                {SCOPES.map((s, i) => (
                  <tr key={s.scope} className={i % 2 === 0 ? "bg-slate-900" : "bg-slate-900/50"}>
                    <td className="px-4 py-3 font-mono text-amber-400">{s.scope}</td>
                    <td className="px-4 py-3 text-purple-300">{s.primary}</td>
                    <td className="px-4 py-3 text-blue-300">{s.fallback}</td>
                    <td className="px-4 py-3 text-slate-300">{s.timeout}</td>
                    <td className="px-4 py-3 text-slate-300">{s.tokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col md:flex-row gap-3 items-stretch">
            {FALLBACK_CHAIN.map((f, i) => (
              <div key={f.label} className="flex md:flex-col items-center gap-2 flex-1">
                <div className="rounded-xl border border-slate-700 p-4 bg-slate-900 flex-1 w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-6 h-6 rounded-full ${f.color} flex items-center justify-center text-white text-xs font-bold`}>
                      {i + 1}
                    </span>
                    <span className="font-semibold text-white text-sm">{f.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 block mb-1">{f.sub}</span>
                  <span className="text-xs text-slate-300">{f.outcome}</span>
                </div>
                {i < FALLBACK_CHAIN.length - 1 && (
                  <span className="text-slate-600 text-xl hidden md:block">›</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Key Files ── */}
        <section>
          <SectionLabel>Key Files Quick Reference</SectionLabel>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {[
              { group: "Pipelines", files: ["pipelines/resume-tailor.ts", "pipelines/cover-letter-draft.ts", "pipelines/jd-parse.ts", "pipelines/claim-generation.ts", "pipelines/validation.ts"] },
              { group: "Source / Truth Lock", files: ["lib/resume-source-packet.ts", "lib/resume-templates.ts", "lib/best-practices.ts", "lib/prompt-router.ts"] },
              { group: "AI Infrastructure", files: ["lib/ai-client.ts", "lib/model-config.ts", "lib/seed-model-configs.ts", "lib/model-config-health.ts"] },
              { group: "Routes (api-server)", files: ["routes/jobs.ts", "routes/claims.ts", "routes/resume-versions.ts", "routes/cover-letters.ts", "routes/assisted-apply.ts", "routes/admin-health.ts"] },
              { group: "Frontend Pages", files: ["pages/apply-wizard/index.tsx", "pages/claims.tsx", "pages/base-resume.tsx", "pages/resume-versions.tsx", "pages/ai-config.tsx"] },
              { group: "Database Schema", files: ["lib/db/src/schema/jobs.ts", "lib/db/src/schema/claims.ts", "lib/db/src/schema/resume-versions.ts", "lib/db/src/schema/model-configs.ts", "lib/db/src/schema/event-logs.ts"] },
            ].map((g) => (
              <div key={g.group} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{g.group}</div>
                {g.files.map((f) => (
                  <div key={f} className="font-mono text-xs text-amber-300 leading-relaxed">
                    {f}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── Legend ── */}
        <section>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <LegendItem color="bg-purple-500" label="AI pipeline step" />
            <LegendItem color="bg-amber-500" label="API route" />
            <LegendItem color="bg-emerald-500" label="Database write" />
            <LegendItem color="bg-slate-500" label="Deterministic / no AI" />
            <LegendItem color="bg-rose-500" label="Validation failure / fallback" />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2">
      {children}
    </h2>
  );
}

function StepCard({
  step,
  isActive,
  onClick,
}: {
  step: (typeof STEPS)[number];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl border text-left transition-all duration-150 overflow-hidden group
        ${isActive ? `ring-2 ${step.ring} border-transparent` : "border-slate-700 hover:border-slate-500"}`}
    >
      <div className={`bg-gradient-to-br ${step.color} px-4 py-3 flex items-center gap-2`}>
        <span className="text-white/80 font-bold text-xs w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          {step.num}
        </span>
        <span className="text-white font-bold text-sm">{step.label}</span>
        <span className="ml-auto text-lg">{step.icon}</span>
      </div>
      <div className="bg-slate-900 px-4 py-3 space-y-2">
        {step.ai && (
          <span className="inline-block text-xs rounded px-1.5 py-0.5 bg-purple-900 text-purple-300 font-mono">
            AI
          </span>
        )}
        <div className="text-slate-400 text-xs leading-relaxed line-clamp-3 group-hover:text-slate-300 transition-colors">
          {step.userAction}
        </div>
        <div className="pt-1 space-y-0.5">
          {step.routes.slice(0, 2).map((r) => (
            <div key={r} className="font-mono text-xs text-amber-500/80 truncate">
              {r}
            </div>
          ))}
          {step.routes.length > 2 && (
            <div className="text-slate-600 text-xs">+{step.routes.length - 2} more routes</div>
          )}
        </div>
      </div>
      <div className={`px-4 py-2 ${step.storeColor} text-xs`}>
        <span className="opacity-60">Stores → </span>
        <span className="font-mono truncate">{step.stores[0].split(" ")[0]}</span>
      </div>
    </button>
  );
}

function DetailBox({
  label,
  icon,
  color,
  children,
  mono,
}: {
  label: string;
  icon: string;
  color: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 ${color} border border-slate-700`}>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
        <span>{icon}</span>
        {label}
      </div>
      <div className={`text-slate-300 text-xs leading-relaxed ${mono ? "font-mono" : ""}`}>{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-slate-500">{k}: </span>
      <span className={`text-slate-300 ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  );
}

function SwimRow({
  lane,
  color,
  icon,
  children,
  last,
}: {
  lane: string;
  color: string;
  icon: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex ${!last ? "border-b border-slate-800" : ""}`}>
      <div
        className={`${color} w-28 flex-shrink-0 px-3 py-3 flex items-center gap-1.5 border-r border-slate-800`}
      >
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold text-slate-300">{lane}</span>
      </div>
      <div className="flex flex-1 divide-x divide-slate-800">{children}</div>
    </div>
  );
}

function SwimCell({
  text,
  color,
  textColor = "text-slate-300",
  mono,
}: {
  text: string;
  color: string;
  textColor?: string;
  mono?: boolean;
}) {
  return (
    <div className={`flex-1 px-3 py-3 text-xs leading-relaxed ${color} ${textColor} ${mono ? "font-mono" : ""} whitespace-pre-line`}>
      {text}
    </div>
  );
}

function OutcomeBox({
  icon,
  label,
  color,
  desc,
}: {
  icon: string;
  label: string;
  color: string;
  desc: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold text-white text-sm">{label}</span>
      </div>
      <p className="text-slate-300 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
      {label}
    </div>
  );
}
