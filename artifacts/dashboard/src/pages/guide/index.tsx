import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ClipboardCheck,
  Info,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="border-b pb-2 text-2xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-20 space-y-3">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">{children}</code>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted p-4 font-mono text-sm leading-relaxed">
      {children}
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted">
            {headers.map((header) => (
              <th key={header} className="border border-border px-3 py-2 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-background" : "bg-muted/30"}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-border px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: "pass" | "partial" | "planned" }) {
  const map = {
    pass: { label: "Ready", className: "border-green-300 bg-green-100 text-green-800" },
    partial: { label: "Partial", className: "border-yellow-300 bg-yellow-100 text-yellow-800" },
    planned: { label: "Planned", className: "border-blue-300 bg-blue-100 text-blue-800" },
  };
  const item = map[status];
  return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${item.className}`}>{item.label}</span>;
}

const TOC_ITEMS = [
  { id: "what-is", label: "1. What This Tool Is" },
  { id: "status", label: "2. Current Status" },
  { id: "quick-start", label: "3. Quick Start" },
  { id: "modules", label: "4. Module Walkthroughs" },
  { id: "ai-strategy", label: "5. AI Strategy" },
  { id: "safe-apply", label: "6. Assisted Apply Policy" },
  { id: "testing", label: "7. Smoke Test" },
  { id: "deployment", label: "8. Deployment" },
  { id: "troubleshooting", label: "9. Troubleshooting" },
  { id: "changelog", label: "10. Changelog" },
  { id: "roadmap", label: "11. Roadmap" },
];

export default function GuidePage() {
  return (
    <div className="relative flex gap-8">
      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-6 space-y-1 text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contents</p>
          {TOC_ITEMS.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="block py-0.5 font-medium text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </a>
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-12 pb-16">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Job Ops Founder Guide</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            A private, single-user, human-in-the-loop platform for job application operations, resume tailoring, AI review, assisted apply planning, and freelance proposal drafting.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">Internal tool only</Badge>
            <Badge variant="outline">Human approval required</Badge>
            <Badge variant="outline">Not a mass auto-apply bot</Badge>
            <Badge variant="outline">Truth-lock claims</Badge>
          </div>
        </div>

        <Separator />

        <Section id="what-is" title="1. What This Tool Is">
          <p className="text-muted-foreground">
            Job Ops helps run a careful, truthful job search. It prepares materials, tracks applications, logs outcomes, and keeps every AI-generated output behind human review.
          </p>
          <Table
            headers={["Principle", "How the app enforces it"]}
            rows={[
              ["Quality over quantity", "The app helps prioritize strong matches and keeps applications in a visible queue."],
              ["Truthfulness", "The Claims Ledger is the factual source of truth. Tailored resumes and cover letters must cite existing claims."],
              ["Human approval", "Resume, cover letter, claim, proposal, and assisted-apply workflows require explicit user review."],
              ["Auditability", "AI calls, approvals, assisted-apply sessions, and proposal drafts are recorded through event logs or dedicated history tables."],
              ["Account safety", "LinkedIn, Indeed, ZipRecruiter, Upwork, and similar sites are assist-only unless official API access or permission allows more."],
            ]}
          />
        </Section>

        <Section id="status" title="2. Current Status">
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
            <div>
              <p className="font-bold text-green-800">Private test-phase system: ready after DB schema push</p>
              <p className="text-sm text-green-700">
                Core app flows build and typecheck. New schema must be pushed to the configured PostgreSQL database before using the latest AI Review, Assisted Apply, and Freelance pages.
              </p>
            </div>
          </div>
          <Table
            headers={["Area", "Status", "Notes"]}
            rows={[
              ["Session auth", <StatusBadge status="pass" />, "Admin bootstrap, login/logout, account page, and protected routes are implemented."],
              ["Base Resume", <StatusBadge status="pass" />, "Plain-text editing, immutable history, restore, and DOCX/PDF import are implemented."],
              ["Claims Ledger", <StatusBadge status="pass" />, "Manual CRUD plus AI claim drafting from pasted notes or DOCX/PDF upload."],
              ["Resume tailoring", <StatusBadge status="pass" />, "Uses current base resume version, selected claims, full draft text, and truth-lock validation."],
              ["Cover letters", <StatusBadge status="pass" />, "Claim-attributed paragraphs with approval/rejection state machine."],
              ["AI Review", <StatusBadge status="partial" />, "Prompt versions, run evaluations, training examples, and review overview are scaffolded."],
              ["Assisted Apply", <StatusBadge status="partial" />, "Safe session/action scaffolding exists. Browser extension is next."],
              ["AI Learning", <StatusBadge status="pass" />, "Bayesian auto-optimizer learns from outcomes to improve prompts/model configs."],
              ["User Management", <StatusBadge status="pass" />, "Admin-only user CRUD with role-based visibility and secure password generation."],
              ["Freelance Copilot", <StatusBadge status="partial" />, "Profiles, projects, fit scoring, proposal drafts, and outcomes are scaffolded."],
              ["External site auto-submit", <StatusBadge status="planned" />, "Not implemented by design. Future work must remain human-approved and terms-aware."],
            ]}
          />
        </Section>

        <Section id="quick-start" title="3. Quick Start">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["1. Confirm env", "Set DATABASE_URL, SESSION_SECRET, OpenRouter vars, and first-run ADMIN_* vars in .env or production env."],
              ["2. Push schema", "Run pnpm --filter @workspace/db run push after pulling these latest schema changes."],
              ["3. Log in", "Start API and dashboard, then log in with the bootstrapped admin account."],
              ["4. Add base resume", "Go to Base Resume. Paste text or import DOCX/PDF. This unlocks resume tailoring."],
              ["5. Build claims", "Use Claims Ledger manually or AI Draft Claims. Review every draft before creating claims."],
              ["6. Configure models", "Go to AI Config. Add default plus task-specific configs: jd_parsing, claim_generation, resume_tailoring, cover_letter, proposal_drafting."],
              ["7. Ingest jobs", "Paste job descriptions in Jobs Pipeline, parse them, score them, tailor resume, and draft cover letter."],
              ["8. Run wizard compare", "Open /apply-wizard and in Tailor step optionally compare up to 3 models per artifact, choose winners, then promote winners to queues."],
              ["9. Review queues", "Approve/reject resume and cover letter drafts before using them externally."],
            ].map(([title, text]) => (
              <Card key={title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <CodeBlock>{`corepack pnpm --filter @workspace/db run push
corepack pnpm run dev

# Health check
curl http://localhost:8080/api/healthz`}</CodeBlock>
        </Section>

        <Section id="modules" title="4. Module Walkthroughs">
          <SubSection id="mod-dashboard" title="Dashboard (/dashboard)">
            <p className="text-sm text-muted-foreground">Shows application stats and recent job activity. Stats update as applications and feedback signals change.</p>
          </SubSection>

          <SubSection id="mod-base-resume" title="Base Resume (/base-resume)">
            <p className="text-sm text-muted-foreground">
              Stores the global source-of-truth resume as immutable versions. Saving or importing always creates a new current version and preserves history.
            </p>
            <Table
              headers={["Action", "Behavior"]}
              rows={[
                ["Save text", "Creates a new current base resume version and demotes the prior current row."],
                ["Import DOCX/PDF", "Extracts text server-side, stores only extracted text, and rejects empty/scanned PDFs."],
                ["Restore history", "Clones an older version into a fresh current version instead of mutating history."],
              ]}
            />
          </SubSection>

          <SubSection id="mod-wizard" title="Apply Wizard (/apply-wizard)">
            <p className="text-sm text-muted-foreground">
              Guided flow: Intake - Parse - Role + Claims - Tailor - Approve - Assisted Apply. Route is feature-flagged by <Code>VITE_ENABLE_APPLY_WIZARD</Code>.
            </p>
            <Table
              headers={["Tailor mode", "Behavior"]}
              rows={[
                [
                  "System defaults",
                  "Generates one resume + one cover letter through normal AI Config task routing (resume_tailoring, cover_letter).",
                ],
                [
                  "Custom model comparison",
                  "Compares up to 3 models for resume and up to 3 for cover letter independently. Uses hybrid model picker from /ai-model-catalog, then promotes selected winners into normal queues.",
                ],
              ]}
            />
            <p className="text-sm text-muted-foreground">
              Comparison runs write audit metadata to event logs. Only promoted winners remain in standard approval queues.
            </p>
          </SubSection>

          <SubSection id="mod-claims" title="Claims Ledger (/claims)">
            <p className="text-sm text-muted-foreground">
              The truth-lock layer. Claims are atomic facts the AI may reuse in resumes, cover letters, and proposals.
            </p>
            <Table
              headers={["Feature", "Behavior"]}
              rows={[
                ["Manual claim CRUD", "Create, edit, deactivate, and tag claims."],
                ["AI Draft Claims", "Paste notes and optionally upload DOCX/PDF. AI returns editable draft claims only; nothing is inserted automatically."],
                ["Evidence type", "Drafts from uploads default to document evidence; pasted text defaults to self_attestation."],
                ["Truth guard", "Claims should include disallowed implications so future tailoring avoids overstating facts."],
              ]}
            />
          </SubSection>

          <SubSection id="mod-jobs" title="Jobs Pipeline and Job Detail (/jobs, /jobs/:id)">
            <Table
              headers={["Step", "What happens"]}
              rows={[
                ["Ingest", "Paste title, company, source URL, and raw JD text."],
                ["Parse JD", "AI extracts required skills, nice-to-haves, responsibilities, salary, and keywords."],
                ["Score", "Role profiles score jobs with hard filters and soft keyword weights."],
                ["Claim Matches", "Ranks active claims against parsed JD terms."],
                ["Tailor Resume", "Requires current base resume. Produces full draft text tied to exact base resume version."],
                ["Draft Cover Letter", "Produces claim-attributed paragraphs for review."],
              ]}
            />
          </SubSection>

          <SubSection id="mod-queues" title="Review Queues (/resume-versions, /cover-letters)">
            <p className="text-sm text-muted-foreground">
              Resume and cover letter drafts remain pending until approved or rejected. Repeated approve/reject attempts return a conflict instead of changing history.
            </p>
          </SubSection>

          <SubSection id="mod-applications" title="Applications and Feedback (/applications, /feedback)">
            <p className="text-sm text-muted-foreground">
              Applications track lifecycle status, documents used, platform, confirmation refs, and notes. Feedback signals log outcomes for future self-learning.
            </p>
          </SubSection>

          <SubSection id="mod-ai-review" title="AI Review (/ai-review)">
            <p className="text-sm text-muted-foreground">
              Stores prompt versions, shows recent AI events, and provides the starting point for supervised learning. Active prompt versions can override built-in system prompts per task.
            </p>
          </SubSection>

          <SubSection id="mod-ai-learning" title="AI Learning (/ai-learning)">
            <p className="text-sm text-muted-foreground">
              Bayesian auto-optimizer that improves prompt versions and model configs by learning from your application outcomes (offer, hired, rejected, ghosted).
            </p>
            <Table
              headers={["Mode", "Behavior"]}
              rows={[
                ["Suggest", "Shows promotion suggestions with confidence scores. You manually click to promote winning prompt variants."],
                ["Auto-Promote", "System automatically promotes winners when confidence exceeds the threshold. Every auto-promotion is revertable."],
                ["Recompute", "Aggregates feedback signals, compares variant pairs using Monte Carlo Bayesian inference, and produces comparison records."],
              ]}
            />
          </SubSection>

          <SubSection id="mod-users" title="User Management (/admin/users)">
            <p className="text-sm text-muted-foreground">
              Admin-only page for managing authorized users. The initial bootstrap admin must be promoted to <Code>role=admin</Code> in the database after first deploy.
            </p>
            <Table
              headers={["Feature", "Behavior"]}
              rows={[
                ["Add User", "Generates a cryptographically secure random password. Stores username, email, first name, last name."],
                ["Edit User", "Update name, email, or role. Password is never shown — use Reset Password to issue a new one."],
                ["Reset Password", "Issues a new secure random password. Displays it once for copy-paste."],
                ["Delete User", "Admins cannot delete themselves or the last remaining admin."],
              ]}
            />
          </SubSection>

          <SubSection id="mod-assisted" title="Assisted Apply (/assisted-apply)">
            <p className="text-sm text-muted-foreground">
              Creates audit records for guided application sessions. It does not log into sites, bypass MFA/CAPTCHA, or submit applications. Use it to track future extension/worker-assisted sessions.
            </p>
          </SubSection>

          <SubSection id="mod-freelance" title="Freelance Copilot (/freelance)">
            <p className="text-sm text-muted-foreground">
              Stores contractor profiles, manually captured Upwork-style projects, fit scores, AI proposal drafts, and proposal outcomes. Proposals are drafts for human review and manual submission.
            </p>
          </SubSection>

          <SubSection id="mod-config" title="AI Config (/ai-config)">
            <Table
              headers={["Task scope", "Used for"]}
              rows={[
                ["default", "Fallback for unconfigured AI tasks."],
                ["jd_parsing", "Job description parsing."],
                ["claim_generation", "AI Draft Claims."],
                ["resume_tailoring", "Tailored resume drafts."],
                ["cover_letter", "Cover letter drafts."],
                ["job_fit_scoring", "Future AI-assisted job fit analysis."],
                ["project_fit_scoring", "Future AI-assisted freelance project fit analysis."],
                ["proposal_drafting", "Freelance proposal drafts."],
              ]}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Wizard comparison uses per-call model overrides, so testing custom models does not alter your default AI routing configuration.
            </p>
          </SubSection>
        </Section>

        <Section id="ai-strategy" title="5. AI Strategy">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  V1: Grounding
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The app improves quality through better source material: base resume, claims, role profiles, parsed jobs, and reviewed outputs.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-green-600" />
                  V2: Bayesian Learning
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Prompt versions and model configs are compared via Bayesian inference using your application outcomes. Winners are promoted automatically or with one click.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4" />
                  V3: Fine-tuning Later
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Fine-tuning should wait until enough human-approved examples and outcome data exist. Never train on data that violates platform terms.
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section id="safe-apply" title="6. Assisted Apply Policy">
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-700" />
            <p className="text-sm text-yellow-900">
              LinkedIn, Indeed, ZipRecruiter, Upwork, and many career sites restrict unauthorized automation. Job Ops must remain assist-only unless an official API or written permission allows more.
            </p>
          </div>
          <Table
            headers={["Allowed", "Not allowed"]}
            rows={[
              ["Draft answers, proposals, resumes, cover letters, and messages.", "Stealth login bots or exported-cookie/session-token automation."],
              ["Capture a page the user opened and approved through a browser extension.", "Bypassing MFA, CAPTCHA, rate limits, or anti-bot controls."],
              ["Fill or copy fields after human approval on whitelisted permitted flows.", "Mass auto-apply, proposal spam, or automatic final submission on prohibited platforms."],
              ["Use official APIs when approved.", "Scraping or submitting content where terms prohibit automation."],
            ]}
          />
        </Section>

        <Section id="testing" title="7. Smoke Test">
          <Table
            headers={["Area", "Test"]}
            rows={[
              ["Auth", "Log in, refresh, log out, log back in."],
              ["Base Resume", "Paste text, save, import DOCX/PDF, restore old version."],
              ["Claims", "Create manual claim; use AI Draft Claims from pasted text; create selected draft."],
              ["Jobs", "Ingest job, parse JD, score, view claim matches."],
              ["AI Pipeline", "Tailor resume and draft cover letter; optionally run wizard model comparison and promote winners; approve/reject each queue item."],
              ["AI Review", "Create inactive prompt version; create active version only when intentionally overriding a task."],
              ["Assisted Apply", "Create a session record and verify it appears in the session log."],
              ["Freelance", "Create profile, capture project, score project, draft proposal."],
            ]}
          />

          <div className="mt-6 rounded-lg border p-4">
            <h3 className="text-base font-semibold">GSD A/B Prompt Verification (No Existing Data)</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this when GSD asks for <Code>taskScope</Code>, <Code>windowStart/windowEnd</Code>, and Prompt Version A/B IDs.
            </p>
            <Table
              headers={["Step", "Action"]}
              rows={[
                ["1. Prepare data", "Base Resume: save a resume. Claims Ledger: create 3-5 claims. Jobs Pipeline: ingest and parse at least 2 jobs."],
                ["2. Create Version A", "AI Review -> Create Prompt Version: taskScope=resume_tailoring, label=baseline-v1, version=1, keep {{userPrompt}}, set active, save."],
                ["3. Generate A runs", "Jobs Pipeline: Tailor Resume for 1-2 jobs. Resumes Queue: approve/reject outputs."],
                ["4. Create Version B", "AI Review -> Create Prompt Version: taskScope=resume_tailoring, label=improved-v2, version=2, improved system prompt, set active, save."],
                ["5. Generate B runs", "Tailor Resume for 1-2 jobs again, then approve/reject in Resumes Queue."],
                ["6. Collect values", "From AI Review copy Prompt Version A ID, Prompt Version B ID, and use one ISO time window covering both rounds."],
                ["7. Send to GSD", "Provide taskScope, windowStart, windowEnd, promptVersionAId, promptVersionBId."],
              ]}
            />

            <CodeBlock>{`taskScope: resume_tailoring
windowStart: <ISO>
windowEnd: <ISO>
promptVersionAId: <baseline-v1 id>
promptVersionBId: <improved-v2 id>`}</CodeBlock>
          </div>
        </Section>

        <Section id="deployment" title="8. Deployment">
          <p className="text-sm text-muted-foreground">
            Deploy via DigitalOcean App Platform or any Node 24 host with a PostgreSQL database. See <Code>docs/DEPLOY_DIGITALOCEAN.md</Code> for the full guide.
          </p>
          <Table
            headers={["Step", "Action"]}
            rows={[
              ["1. Environment", "Set DATABASE_URL, SESSION_SECRET, AI_INTEGRATIONS_OPENROUTER_API_KEY, ADMIN_* vars as env vars in production."],
              ["2. Schema", "Run pnpm --filter @workspace/db run push (or compat if drift). For non-interactive setup, use a manual SQL migration script."],
              ["3. Dashboard build", "Set VITE_ENABLE_APPLY_WIZARD=true during the dashboard build step if you want the wizard route enabled."],
              ["4. Admin role", "After first deploy, run UPDATE admin_users SET role = 'admin' WHERE id = 1; to enable User Management."],
              ["5. Landing page", "Set VITE_PUBLIC_APP_URL to your production domain for proper OGP tag resolution."],
            ]}
          />
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 mt-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div className="text-sm text-blue-900">
              <strong>Two-PC workflow:</strong> See <Code>docs/HANDOFF.md</Code> for the cross-PC session transition checklist. Always commit, push, and run DB migrations before switching machines.
            </div>
          </div>
        </Section>

        <Section id="troubleshooting" title="9. Troubleshooting">
          <div className="grid gap-4">
            {[
              ["Missing tables or 500s on new pages", "Run pnpm --filter @workspace/db run push. If that fails due to drift, use pnpm --filter @workspace/db run compat."],
              ["AI calls fail", "Check AI_INTEGRATIONS_OPENROUTER_API_KEY, base URL, model config, and OpenRouter account limits."],
              ["Tailor Resume returns 400", "Save or import a current base resume first."],
              ["Imported PDF is empty", "The PDF is probably scanned/image-only. V1 does not perform OCR; paste text or upload text-based PDF/DOCX."],
              ["Proposal draft fails", "Configure proposal_drafting or default model in AI Config and confirm the project has a linked freelance profile."],
            ].map(([title, text]) => (
              <Card key={title}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="changelog" title="10. Changelog">
          <div className="space-y-6">
            <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4">
              <h3 className="mb-2 text-lg font-semibold">Version 0.4 (April 27, 2026)</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                AI Self-Learning Loop, User Management, Landing Page, and global motion design overhaul.
              </p>
              <Table
                headers={["Category", "Changes"]}
                rows={[
                  ["AI Learning", "Bayesian auto-optimizer that compares prompt versions and model configs using application outcomes. Suggest mode with manual promotion, auto-promote mode with one-click revert, and nightly cron scheduler."],
                  ["User Management", "Admin-only user CRUD (/admin/users) with secure password generation, role-based visibility, self/last-admin deletion protection, and rate-limited auth endpoints."],
                  ["Landing Page", "Public marketing page at / (unauthenticated). Authenticated users redirect to /dashboard. Full-page sections with Framer Motion animations."],
                  ["Motion Design", "Global motion system: page transitions via AnimatePresence, scroll-triggered fade-in components, card hover/tap micro-interactions, Bento-grid dashboard, and glassmorphism utilities."],
                ]}
              />
            </div>

            <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4">
              <h3 className="mb-2 text-lg font-semibold">Version 0.3 (April 22, 2026)</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Apply Wizard model comparison release: hybrid OpenRouter catalog picker, compare endpoints, and winner-promotion flow into standard queues.
              </p>
              <Table
                headers={["Category", "Changes"]}
                rows={[
                  ["Wizard UI", "Added system-default vs custom comparison mode in Tailor step, with up to 3 model selections per artifact and per-artifact winner picking."],
                  ["Model Catalog", "Added hybrid picker source from /ai-model-catalog that marks configured/default models while searching full OpenRouter catalog."],
                  ["API", "Added compare and promote endpoints for resume and cover letter plus per-call modelOverride support."],
                  ["Audit + Queues", "Comparison metadata is logged; only promoted winners are persisted in normal approval queues."],
                ]}
              />
            </div>

            <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4">
              <h3 className="mb-2 text-lg font-semibold">Version 0.2 (April 20, 2026)</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                M002 Regression Audit &amp; Stabilization. Fixed database schema drift affecting multiple app pages.
              </p>
              <Table
                headers={["Category", "Changes"]}
                rows={[
                  ["Database", "Created runtime-compat.sql patch covering all missing tables/columns for M002, Assisted Apply, Freelance Copilot, and AI Metrics."],
                  ["API", "Mounted aiMetricsSnapshotRouter (was defined but not wired). Added missing unique index for ai_run_evaluations upserts."],
                  ["Dashboard", "Hardened AI Metrics page against undefined snapshot data - prevents crash on backend errors."],
                  ["Tooling", "Added 'pnpm --filter @workspace/db run compat' command for reliable schema reconciliation."],
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                See <Code>docs/CHANGELOG.md</Code> for full details.
              </p>
            </div>

            <div className="rounded-lg border border-muted p-4">
              <h3 className="mb-2 text-base font-semibold text-muted-foreground">Version 0.1 (April 16, 2026)</h3>
              <p className="text-sm text-muted-foreground">
                Initial release. Core platform with auth, job pipeline, resume tailoring, cover letters, Claims Ledger, AI Review foundation, Assisted Apply scaffolding, and Freelance Copilot scaffolding.
              </p>
            </div>
          </div>
        </Section>

        <Section id="roadmap" title="11. Roadmap">
          <Table
            headers={["Priority", "Work"]}
            rows={[
              ["P1", "Build browser extension MVP: page capture, Easy Apply auto-fill, autonomous job discovery + application bot with keyword/score filtering (LinkedIn, Indeed, ZipRecruiter)."],
              ["P1", "Add richer AI evaluation forms and training-example promotion UI."],
              ["P2", "Outcome analytics: correlate interviews/offers with claims, prompt versions, models, and proposals."],
              ["P2", "Add export/copy/PDF for approved resumes, cover letters, and proposals."],
              ["P3", "Add 2FA admin controls in User Management."],
              ["P3", "Fine-tuning pipeline: train on human-approved examples when dataset is large enough."],
            ]}
          />
        </Section>

        <Separator />
        <p className="text-center text-xs text-muted-foreground">
          Job Ops Founder Guide - Last updated April 27, 2026 - Also available in <Code>docs/USER_GUIDE.md</Code>
        </p>
      </div>
    </div>
  );
}
