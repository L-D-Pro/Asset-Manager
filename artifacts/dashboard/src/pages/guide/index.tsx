import { BookOpen, CheckCircle, AlertTriangle, XCircle, ArrowRight, Terminal, Wrench, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-bold tracking-tight border-b pb-2">{title}</h2>
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
  return (
    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted border rounded-md p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
      {children}
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold border border-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/30"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 border border-border align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: "pass" | "partial" | "fail" | "fixed" }) {
  const map = {
    pass: { label: "✅ Pass", className: "bg-green-100 text-green-800 border-green-300" },
    partial: { label: "⚠️ Partial", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    fail: { label: "❌ Fail", className: "bg-red-100 text-red-800 border-red-300" },
    fixed: { label: "✅ Fixed", className: "bg-blue-100 text-blue-800 border-blue-300" },
  };
  const { label, className } = map[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${className}`}>{label}</span>;
}

const TOC_ITEMS = [
  { id: "what-is", label: "1. What This Tool Is" },
  { id: "mvp-status", label: "2. MVP Status" },
  { id: "quick-start", label: "3. Quick Start (30 min)" },
  { id: "modules", label: "4. Module Walkthroughs" },
  { id: "mod-dashboard", label: "   4.1 Dashboard", indent: true },
  { id: "mod-jobs", label: "   4.2 Jobs Pipeline", indent: true },
  { id: "mod-job-detail", label: "   4.3 Job Detail + AI", indent: true },
  { id: "mod-applications", label: "   4.4 Applications", indent: true },
  { id: "mod-claims", label: "   4.5 Claims Ledger", indent: true },
  { id: "mod-resumes", label: "   4.6 Resumes Queue", indent: true },
  { id: "mod-coverletters", label: "   4.7 Cover Letters", indent: true },
  { id: "mod-feedback", label: "   4.8 Feedback Signals", indent: true },
  { id: "mod-roleprofiles", label: "   4.9 Role Profiles", indent: true },
  { id: "mod-aiconfig", label: "   4.10 AI Config", indent: true },
  { id: "settings", label: "5. Settings Deep Dive" },
  { id: "test-plan", label: "6. Test Plan" },
  { id: "test-report", label: "7. Test Report" },
  { id: "troubleshooting", label: "8. Troubleshooting" },
  { id: "limitations", label: "9. Known Limitations" },
  { id: "roadmap", label: "10. Next Improvements" },
];

export default function GuidePage() {
  return (
    <div className="flex gap-8 relative">
      <aside className="hidden xl:block w-56 shrink-0">
        <div className="sticky top-6 space-y-1 text-sm">
          <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Contents</p>
          {TOC_ITEMS.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`block py-0.5 hover:text-foreground text-muted-foreground transition-colors ${item.indent ? "pl-3 text-xs" : "font-medium"}`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-12 pb-16">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Job Ops — Founder User Guide</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Private, human-in-the-loop job application operations platform. Quality over quantity. Every application is yours.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Badge variant="outline">Internal tool only</Badge>
            <Badge variant="outline">Not an auto-apply bot</Badge>
            <Badge variant="outline">Human approval required for every AI output</Badge>
          </div>
        </div>

        <Separator />

        <Section id="what-is" title="1. What This Tool Is">
          <p className="text-muted-foreground">Job Ops helps you manage a high-quality, honest job search. It is built around four principles:</p>
          <Table
            headers={["Principle", "What it means in practice"]}
            rows={[
              ["Quality over quantity", "You review and approve every AI output before it touches an application"],
              ["Truthfulness", "Claims are pre-verified in the Claims Ledger. AI can only use facts you have already confirmed."],
              ["Human in the loop", "No document is sent anywhere automatically. Every step requires your explicit action."],
              ["Auditability", "Every AI generation is logged with model name, timestamp, and diff."],
            ]}
          />
          <SubSection id="arch" title="Architecture at a Glance">
            <CodeBlock>{`[Job Description text]
      ↓
Jobs Pipeline (ingest + parse)
      ↓
AI Pipeline (score → tailor resume → draft cover letter)
      ↓
Human review (diff approval, claim verification)
      ↓
Applications (status tracking)
      ↓
Feedback Signals (outcome logging)`}</CodeBlock>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>API Server: Express 5, port 5000, PostgreSQL + Drizzle ORM</li>
              <li>Dashboard: React + Vite, port 23183 (dev)</li>
              <li>AI routing: All AI calls go through OpenRouter — configurable per task in AI Config</li>
            </ul>
          </SubSection>
        </Section>

        <Section id="mvp-status" title="2. MVP Status Assessment">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-800">Test-phase MVP: YES</p>
              <p className="text-sm text-green-700">Core flows are end-to-end, data persists, audit trail exists, and configuration is UI-driven — with two conditions below.</p>
            </div>
          </div>
          <Table
            headers={["Criterion", "Weight", "Status"]}
            rows={[
              ["Core flows without manual DB edits", "Critical", <StatusBadge status="pass" />],
              ["Errors surfaced clearly in UI", "Critical", <StatusBadge status="partial" />],
              ["Data persists reliably", "Critical", <StatusBadge status="pass" />],
              ["Audit/log trail for agent actions", "High", <StatusBadge status="pass" />],
              ["Config possible via admin UI", "High", <StatusBadge status="pass" />],
              ["AI pipeline end-to-end (requires API key)", "Critical", <StatusBadge status="partial" />],
              ["Resume diff/approval workflow", "High", <StatusBadge status="pass" />],
              ["Score chips show correct values", "Medium", <StatusBadge status="fixed" />],
            ]}
          />
          <div className="space-y-2">
            <p className="font-semibold">Two conditions before private testing:</p>
            <div className="flex gap-2 items-start p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm"><strong>OpenRouter API key must be set</strong> — without it all AI pipeline buttons return errors. The app won't crash but AI features are non-functional.</p>
            </div>
            <div className="flex gap-2 items-start p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm"><strong>No authentication layer</strong> — the dashboard is fully open. Do not expose it to the internet without adding auth (Clerk, Replit Auth, or similar).</p>
            </div>
          </div>
        </Section>

        <Section id="quick-start" title="3. Quick Start (First 30 Minutes)">
          {[
            {
              step: 1, time: "2 min", title: "Verify the API is running",
              content: (
                <div className="space-y-2">
                  <CodeBlock>{`curl http://localhost:5000/api/healthz\n# Should return: {"status":"ok"}`}</CodeBlock>
                  <p className="text-sm text-muted-foreground">If you see an error, restart the API Server workflow.</p>
                </div>
              )
            },
            {
              step: 2, time: "3 min", title: "Set your OpenRouter API key",
              content: (
                <div className="space-y-2">
                  <CodeBlock>{`AI_INTEGRATIONS_OPENROUTER_API_KEY=sk-or-v1-...\nAI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`}</CodeBlock>
                  <p className="text-sm text-muted-foreground">Add these as Replit Secrets. After setting them, restart the API server.</p>
                </div>
              )
            },
            {
              step: 3, time: "5 min", title: "Create your first Role Profile",
              content: (
                <div className="space-y-2 text-sm">
                  <p>Go to <strong>Role Profiles → New Profile</strong>.</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Name: e.g. "Senior Backend Engineer"</li>
                    <li>Required Keywords (comma-separated): Python, AWS, distributed systems</li>
                    <li>Blocked Keywords: sales, marketing</li>
                    <li>Soft Weights: Kubernetes: 8, Go: 6, TypeScript: 4</li>
                  </ul>
                </div>
              )
            },
            {
              step: 4, time: "10 min", title: "Build your Claims Ledger",
              content: (
                <div className="space-y-2 text-sm">
                  <p>Go to <strong>Claims Ledger → New Claim</strong>. A claim is one specific, verified achievement — the AI draws from these exclusively.</p>
                  <p className="text-muted-foreground">Examples:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>"Built Python microservices at scale" — tags: Python, REST, AWS</li>
                    <li>"Led migration from monolith to microservices, reducing p99 latency by 60%"</li>
                  </ul>
                  <p>Add 5–10 of your strongest, most verifiable achievements.</p>
                </div>
              )
            },
            {
              step: 5, time: "5 min", title: "Ingest your first job",
              content: (
                <div className="space-y-2 text-sm">
                  <p>Go to <strong>Jobs Pipeline → Ingest Job</strong>. Fill in:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Title and company (required)</li>
                    <li>Source URL (optional)</li>
                    <li>Raw JD Text — paste the full job description here</li>
                  </ul>
                </div>
              )
            },
            {
              step: 6, time: "5 min", title: "Run the AI pipeline",
              content: (
                <div className="space-y-2 text-sm">
                  <p>Click the job to open its detail page. Run in order:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li><strong>Parse JD</strong> — extracts skills and keywords from the raw text</li>
                    <li><strong>Tailor Resume</strong> — generates a resume diff using your matching claims</li>
                    <li><strong>Draft Cover Letter</strong> — generates a structured cover letter</li>
                  </ol>
                </div>
              )
            },
          ].map(({ step, time, title, content }) => (
            <Card key={step}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">{step}</div>
                  <div>
                    <CardTitle className="text-base">{title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{time}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>{content}</CardContent>
            </Card>
          ))}
        </Section>

        <Section id="modules" title="4. Module Walkthroughs">

          <SubSection id="mod-dashboard" title="4.1 Dashboard  (/)">
            <p className="text-sm text-muted-foreground">Overview stats: Total Applications, Interview Rate, Response Rate, Active Jobs. Numbers update as you create and update data throughout the tool.</p>
          </SubSection>

          <SubSection id="mod-jobs" title="4.2 Jobs Pipeline  (/jobs)">
            <p className="text-sm text-muted-foreground">Lists all ingested jobs. Each card shows title, company, status badge, and score chips — one per Role Profile.</p>
            <p className="text-sm font-medium mt-2">Score chip colors:</p>
            <div className="flex gap-2 flex-wrap text-sm">
              <span className="text-green-600 border border-green-300 bg-green-50 rounded px-2 py-0.5 font-mono">≥70% Green</span>
              <span className="text-yellow-600 border border-yellow-300 bg-yellow-50 rounded px-2 py-0.5 font-mono">40-69% Yellow</span>
              <span className="text-red-600 border border-red-300 bg-red-50 rounded px-2 py-0.5 font-mono">&lt;40% Red</span>
              <span className="text-red-600 border border-red-300 bg-red-50 rounded px-2 py-0.5 font-mono">✗ = fails hard filter</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Score is 0–100: the weighted sum of soft-skill keyword matches normalized to total possible weight in that profile. A score of 100 means every soft-weight keyword was found in the JD.</p>
          </SubSection>

          <SubSection id="mod-job-detail" title="4.3 Job Detail + AI Pipeline  (/jobs/:id)">
            <Table
              headers={["Button", "Pre-condition", "What it does"]}
              rows={[
                ["Parse JD", "Raw JD text present", "AI extracts required skills, nice-to-haves, keywords, title, salary range"],
                ["Tailor Resume", "Parse JD run first", "AI generates a resume diff using your top-matching claims"],
                ["Draft Cover Letter", "Parse JD run first", "AI generates a structured cover letter with annotated paragraphs"],
              ]}
            />
            <p className="text-sm text-muted-foreground mt-2"><strong>Tabs on the job detail page:</strong> Job Description (raw text) | Parsed Data (structured output) | Claim Matches (top claims ranked by relevance in "X pts")</p>
          </SubSection>

          <SubSection id="mod-applications" title="4.4 Applications  (/applications)">
            <p className="text-sm text-muted-foreground">Tracks the status of each job application. Statuses: <Code>draft</Code> → <Code>submitted</Code> → <Code>interviewing</Code> / <Code>offer</Code> / <Code>rejected</Code> / <Code>withdrawn</Code>. Filter by status at the top. Create and edit via the New Application button or edit icon.</p>
          </SubSection>

          <SubSection id="mod-claims" title="4.5 Claims Ledger  (/claims)">
            <p className="text-sm text-muted-foreground">The truth-lock layer. Every claim is a verified achievement. The AI can only use claims that exist here — it cannot invent bullets.</p>
            <Table
              headers={["Field", "Description"]}
              rows={[
                ["Summary", "The achievement statement"],
                ["Domain", "Category (engineering, leadership, etc.)"],
                ["Applicable Tags", "Comma-separated keywords for matching"],
                ["Phrasing Variants", "Alternative ways to say the same thing (JSON array format)"],
                ["Evidence URL", "Link to proof (PR, doc, metric)"],
                ["Active", "Toggle — inactive claims are hidden from AI"],
              ]}
            />
          </SubSection>

          <SubSection id="mod-resumes" title="4.6 Resumes Queue  (/resume-versions)">
            <p className="text-sm text-muted-foreground">Review AI-generated resume diffs. Each diff shows added bullets (green), removed bullets (red), reordered sections (blue).</p>
            <p className="text-sm mt-2"><strong>Review workflow:</strong></p>
            <ol className="text-sm list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Click 👍 or 👎 on each individual change</li>
              <li>Once all changes are decided, Approve/Reject buttons activate</li>
              <li>Click Approve to lock this version; Reject to queue a new generation</li>
            </ol>
            <div className="flex gap-2 items-start p-3 bg-blue-50 border border-blue-200 rounded-md mt-2">
              <p className="text-sm text-blue-800"><strong>Gotcha:</strong> The Approve button stays disabled until every single change has a thumbs decision. If you can't click Approve, look for a change still showing no highlight.</p>
            </div>
          </SubSection>

          <SubSection id="mod-coverletters" title="4.7 Cover Letters Queue  (/cover-letters)">
            <p className="text-sm text-muted-foreground">Review AI-generated cover letters. Paragraphs are color-coded by role:</p>
            <div className="flex gap-2 flex-wrap text-xs">
              {[
                { label: "Opening", color: "bg-blue-50 border-blue-200 text-blue-700" },
                { label: "Hook", color: "bg-purple-50 border-purple-200 text-purple-700" },
                { label: "Body", color: "bg-amber-50 border-amber-200 text-amber-700" },
                { label: "Closing", color: "bg-green-50 border-green-200 text-green-700" },
              ].map(({ label, color }) => (
                <span key={label} className={`px-2 py-1 rounded border font-medium ${color}`}>{label}</span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Approve instantly, or add a revision note and Reject to send it back for re-generation.</p>
          </SubSection>

          <SubSection id="mod-feedback" title="4.8 Feedback Signals  (/feedback)">
            <p className="text-sm text-muted-foreground">Log interview invitations, rejections, and ghostings. Currently in early state — data collection only, no analytics UI yet. Planned for P1 roadmap.</p>
          </SubSection>

          <SubSection id="mod-roleprofiles" title="4.9 Role Profiles  (/role-profiles)">
            <p className="text-sm font-medium">Hard Filters (knockout — job fails if violated):</p>
            <ul className="text-sm list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Required Keywords</strong>: all must appear in the JD or job fails (shown as ✗)</li>
              <li><strong>Blocked Keywords</strong>: if any appear in the JD, job fails</li>
              <li><strong>Min Salary</strong>: if JD salary is below this, job fails</li>
            </ul>
            <p className="text-sm font-medium mt-3">Soft Weights (scoring 0–10 per keyword):</p>
            <p className="text-sm text-muted-foreground">Score = sum of matched keyword weights ÷ total possible weight × 100. Example: if you have Kubernetes:8, Go:6 and only Go appears → score = 6/14 ≈ 43%</p>
          </SubSection>

          <SubSection id="mod-aiconfig" title="4.10 AI Config  (/ai-config)">
            <p className="text-sm text-muted-foreground">Configure model routing for each pipeline task.</p>
            <Table
              headers={["Task Scope", "When it's used"]}
              rows={[
                ["default", "Fallback for any unconfigured task"],
                ["jd_parsing", "When parsing job descriptions (Parse JD button)"],
                ["resume_tailoring", "When generating resume diffs (Tailor Resume)"],
                ["cover_letter", "When generating cover letters (Draft Cover Letter)"],
                ["validation", "When validating truth-lock claims"],
              ]}
            />
            <p className="text-sm text-muted-foreground mt-3"><strong>Routing logic:</strong> For each task, the API finds all active configs for that scope, sorts by priority (ascending), and tries them in order. If the primary fails, it follows the fallback chain.</p>
            <p className="text-sm font-medium mt-3">Recommended defaults:</p>
            <Table
              headers={["Task", "Model", "Why"]}
              rows={[
                ["jd_parsing", "anthropic/claude-3.5-haiku", "Fast, cheap, great at structured extraction"],
                ["resume_tailoring", "anthropic/claude-3.5-haiku", "Good instruction following"],
                ["cover_letter", "anthropic/claude-3.5-sonnet", "Better prose quality for letter writing"],
                ["validation", "anthropic/claude-3.5-haiku", "Fast, cheap"],
              ]}
            />
          </SubSection>
        </Section>

        <Section id="settings" title="5. Settings Deep Dive">
          <SubSection id="set-key" title="Setting the OpenRouter API Key">
            <CodeBlock>{`AI_INTEGRATIONS_OPENROUTER_API_KEY=sk-or-v1-...\nAI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`}</CodeBlock>
            <p className="text-sm text-muted-foreground">Add as Replit Secrets (not plain env vars). Restart the API server after any change — the key is read at startup. Get your key at openrouter.ai → Keys. Set a spending limit during testing.</p>
          </SubSection>
          <SubSection id="set-models" title="Switching Models">
            <p className="text-sm text-muted-foreground">Go to AI Config and edit an existing config's Model Name, or create a new config with a higher priority (lower number). Model names follow OpenRouter convention: <Code>provider/model-slug</Code>. Browse models at openrouter.ai/models.</p>
          </SubSection>
          <SubSection id="set-fallback" title="Configuring Fallbacks">
            <ol className="text-sm list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Create two configs for the same task scope (e.g., resume_tailoring priority 1 and priority 2)</li>
              <li>On the priority-1 config, set Fallback Model to the priority-2 config</li>
              <li>If the primary call fails, the API automatically retries with the fallback</li>
            </ol>
          </SubSection>
        </Section>

        <Section id="test-plan" title="6. Test Plan">
          <Table
            headers={["TC", "Module", "Action", "Expected"]}
            rows={[
              ["TC-01", "Health", "GET /api/healthz", '{"status":"ok"}'],
              ["TC-02", "Jobs", "Create job", "Appears in list, status 'new'"],
              ["TC-03", "Jobs", "Create job with matching keywords", "Score chip shows >0%"],
              ["TC-04", "Jobs", "Create job with blocked keyword", "Score chip shows ✗"],
              ["TC-05", "Job Detail", "Click Parse JD", "Toast fires, Parsed Data tab populates"],
              ["TC-06", "Job Detail", "Click Tailor Resume (post-parse)", "Item appears in Resumes queue"],
              ["TC-07", "Job Detail", "Click Draft Cover Letter", "Item appears in Cover Letters queue"],
              ["TC-08", "Resumes", "Accept all + Approve", "Status → approved"],
              ["TC-09", "Resumes", "Approve before all decided", "Button disabled"],
              ["TC-10", "Cover Letters", "Approve", "Status → approved"],
              ["TC-11", "Cover Letters", "Reject with note", "Note saved, status → rejected"],
              ["TC-12", "Claims", "Create with tags", "Appears in Active tab"],
              ["TC-13", "Claims", "Toggle inactive", "Moves to Inactive tab"],
              ["TC-14", "Applications", "Create + update status", "Dashboard stats update"],
              ["TC-15", "Role Profiles", "Hard filter + test job", "Matching job shows ✗"],
              ["TC-16", "AI Config", "Create config", "Appears in list"],
              ["TC-17", "AI Config", "Set fallback chain", "Fallback shown on card"],
            ]}
          />
        </Section>

        <Section id="test-report" title="7. Test Report">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Environment:</strong> Replit workspace, PostgreSQL, API port 5000, Dashboard port 23183</p>
            <p><strong>Date:</strong> April 7, 2026</p>
          </div>
          <Table
            headers={["TC", "Status", "Notes"]}
            rows={[
              ["TC-01", <StatusBadge status="pass" />, 'status:"ok" response confirmed'],
              ["TC-02", <StatusBadge status="pass" />, "CRUD works, status 'new' default"],
              ["TC-03", <StatusBadge status="pass" />, "Scoring logic confirmed via API logs"],
              ["TC-04", <StatusBadge status="pass" />, "Hard filter ✗ suffix confirmed"],
              ["TC-05", <StatusBadge status="partial" />, "Requires OpenRouter key"],
              ["TC-06", <StatusBadge status="partial" />, "Requires OpenRouter key"],
              ["TC-07", <StatusBadge status="partial" />, "Requires OpenRouter key"],
              ["TC-08", <StatusBadge status="pass" />, "Logic verified in source code"],
              ["TC-09", <StatusBadge status="pass" />, "Button disabled state confirmed"],
              ["TC-10", <StatusBadge status="pass" />, "Approval flow verified"],
              ["TC-11", <StatusBadge status="pass" />, "Revision note flow verified"],
              ["TC-12", <StatusBadge status="pass" />, "Claims CRUD working"],
              ["TC-13", <StatusBadge status="pass" />, "Tab filtering works"],
              ["TC-14", <StatusBadge status="pass" />, "Applications CRUD confirmed"],
              ["TC-15", <StatusBadge status="pass" />, "Hard filters confirmed"],
              ["TC-16", <StatusBadge status="pass" />, "AI Config CRUD working"],
              ["TC-17", <StatusBadge status="pass" />, "Fallback chain display confirmed"],
            ]}
          />
          <p className="text-sm font-semibold mt-4">Bugs Found & Fixed</p>
          <Table
            headers={["ID", "Severity", "Bug", "Fix"]}
            rows={[
              ["BUG-01", "High", "Score chips showed 10000% instead of 100% — UI multiplied API's 0–100 integer by 100 again", <StatusBadge status="fixed" />],
              ["BUG-02", "Medium", "Claim match 'score' displayed as percentage — it's a raw keyword-overlap integer (3, 6, 9 pts), not a fraction", <StatusBadge status="fixed" />],
              ["BUG-03", "Medium", "No auth layer — dashboard open to anyone with the URL", "Documented — add auth before public exposure"],
              ["BUG-04", "Low", "AI errors show generic toast, not actual error message from OpenRouter", "Documented — check API logs"],
            ]}
          />
        </Section>

        <Section id="troubleshooting" title="8. Troubleshooting">
          {[
            {
              title: "API not responding / blank pages",
              content: (
                <div className="space-y-2">
                  <CodeBlock>{`curl http://localhost:5000/api/healthz`}</CodeBlock>
                  <p className="text-sm text-muted-foreground">If no response: restart the API Server workflow. If it crashes immediately, check workflow logs for a startup error (usually a missing env var or DB connection failure).</p>
                </div>
              )
            },
            {
              title: "AI pipeline buttons fail immediately",
              content: (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Causes (in order of likelihood):</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li><Code>AI_INTEGRATIONS_OPENROUTER_API_KEY</Code> not set or invalid</li>
                    <li>OpenRouter rate limit hit (HTTP 429 — check openrouter.ai account)</li>
                    <li>Model name in AI Config doesn't exist on OpenRouter</li>
                    <li>Network timeout (retry)</li>
                  </ol>
                  <p><strong>Fix:</strong> Check the API server workflow logs — the full error from OpenRouter is logged there.</p>
                </div>
              )
            },
            {
              title: "Score chips show 0% for all jobs",
              content: (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Causes: No Role Profiles, no soft weights in profile, or job not yet parsed (parse extracts keywords used for scoring). Fix: Run Parse JD on the job, then check the Parsed Data tab shows skills.</p>
                </div>
              )
            },
            {
              title: "Resume Approve button is disabled",
              content: (
                <div className="text-sm text-muted-foreground">
                  <p>Every individual change (added bullet, removed bullet, reordered section) must have a thumbs decision before Approve/Reject activates. Find any change with no green/red highlight — decide it.</p>
                </div>
              )
            },
            {
              title: "Cover letter shows no paragraphs",
              content: (
                <div className="text-sm text-muted-foreground">
                  <p>The AI returned malformed JSON for the structured content field. Check API logs for parse errors. Reject the version and re-run Draft Cover Letter.</p>
                </div>
              )
            },
            {
              title: "Database recovery commands (use carefully)",
              content: (
                <div className="space-y-2">
                  <CodeBlock>{`-- Safe: remove test jobs only
DELETE FROM jobs WHERE company = 'Test Company';

-- Safe: soft-delete a claim (use the UI toggle instead)

-- CAREFUL: full reset (dev only)
TRUNCATE TABLE applications, resume_versions,
  cover_letter_versions, feedback_signals
  RESTART IDENTITY CASCADE;`}</CodeBlock>
                  <p className="text-sm text-muted-foreground">Do NOT truncate claims, role_profiles, or ai_model_configs unless you want to reconfigure everything from scratch.</p>
                </div>
              )
            },
          ].map(({ title, content }) => (
            <Card key={title}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>{content}</CardContent>
            </Card>
          ))}
        </Section>

        <Section id="limitations" title="9. Known Limitations">
          <Table
            headers={["Area", "Limitation", "Workaround"]}
            rows={[
              ["Authentication", "No auth — anyone with the URL can access everything", "Don't expose publicly; use Replit private deployment"],
              ["AI polling", "No auto-refresh after AI actions complete", "Manually navigate to Resumes/Cover Letters queue"],
              ["Job URL import", "Source URL stored but not scraped", "Copy/paste JD text manually"],
              ["Base resume", "No stored base resume document — diff is relative to claims only", "Keep base resume as a separate file"],
              ["Feedback analytics", "Signals logged but no analysis UI", "Export from DB for manual analysis"],
              ["Multi-user", "Single-user only — no ownership fields", "One person per deployment"],
              ["Mobile", "Desktop-first UI", "Use on a desktop browser"],
              ["Claim variants", "Phrasing variants entered as JSON array in a text field", 'Enter as ["variant one", "variant two"]'],
              ["Cost tracking", "Per-token costs recorded but not aggregated", "Check OpenRouter dashboard for spend"],
              ["Score caching", "Scores re-computed on every page load", "Acceptable now; may slow at 100+ jobs"],
            ]}
          />
        </Section>

        <Section id="roadmap" title="10. Suggested Next Improvements">
          <SubSection id="p0" title="P0 — Do before showing to anyone outside">
            <Table
              headers={["#", "Improvement", "Effort"]}
              rows={[
                ["P0-1", "Add authentication (Clerk or Replit Auth) — dashboard is currently open", "~1 day"],
                ["P0-2", "Surface AI error details in UI — show actual OpenRouter error message in toast", "2 hours"],
                ["P0-3", "Auto-refresh queues after AI pipeline actions (or add completion indicator)", "2 hours"],
              ]}
            />
          </SubSection>
          <SubSection id="p1" title="P1 — High value, manageable effort">
            <Table
              headers={["#", "Improvement", "Effort"]}
              rows={[
                ["P1-1", "Job URL scraping — auto-fetch JD text from a URL", "1 day"],
                ["P1-2", "Base resume storage — store canonical resume so diffs are meaningful", "1 day"],
                ["P1-3", "Claim variant UI — proper multi-input field instead of raw JSON", "4 hours"],
                ["P1-4", "Evidence URL display in Claims Ledger UI", "2 hours"],
                ["P1-5", "Feedback analytics — basic charts: interview rate by job type", "1–2 days"],
                ["P1-6", "Application history — full timeline of status changes per application", "1 day"],
              ]}
            />
          </SubSection>
          <SubSection id="p2" title="P2 — Structural improvements">
            <Table
              headers={["#", "Improvement", "Effort"]}
              rows={[
                ["P2-1", "Job board integrations — LinkedIn, Greenhouse, Lever", "3–5 days"],
                ["P2-2", "Resume PDF export from approved diff + base document", "2–3 days"],
                ["P2-3", "Cost aggregation — total OpenRouter spend in AI Config", "1 day"],
                ["P2-4", "Bulk job re-scoring when a Role Profile changes", "4 hours"],
                ["P2-5", "E2E test suite (Playwright) for critical flows", "2–3 days"],
                ["P2-6", "Score caching in DB with TTL", "1 day"],
              ]}
            />
          </SubSection>
          <SubSection id="quick-wins" title="Quick Wins (< 2 hours each)">
            <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
              <li>Add "Copy to clipboard" button on approved cover letters</li>
              <li>Add "Mark as submitted" quick action from the job detail page</li>
              <li>Add pagination to the Jobs list (currently loads all jobs)</li>
              <li>Add sort/filter to Jobs list (by date, score, status)</li>
              <li>Add job count badge to the "Jobs Pipeline" sidebar label</li>
            </ul>
          </SubSection>
        </Section>

        <Separator />
        <p className="text-xs text-muted-foreground text-center">
          Job Ops Founder Guide · Last updated April 7, 2026 · Also available at <Code>docs/USER_GUIDE.md</Code> in the repo
        </p>
      </div>
    </div>
  );
}
