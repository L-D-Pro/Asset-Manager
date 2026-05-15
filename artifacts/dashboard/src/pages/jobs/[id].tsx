import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  useGetJob,
  useParseJobDescription,
  useTailorJobResume,
  useDraftCoverLetter,
  useGetJobClaimMatches,
  getGetJobQueryKey,
  getGetJobClaimMatchesQueryKey,
  type Job,
  type ClaimMatch,
} from "@workspace/api-client-react";

import { ChevronLeft, ExternalLink, Sparkles, FileText } from "lucide-react";
import { CompanyMark } from "@/components/quiet/company-mark";
import { ScoreRing } from "@/components/quiet/score-ring";
import { StatusChip } from "@/components/quiet/status-chip";
import { useToast } from "@/hooks/use-toast";

type TabId = "overview" | "claims" | "research" | "audit";

export default function JobDetail() {
  const params = useParams<{ id: string }>();
  const jobId = Number(params.id ?? 0);
  const { data: job, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) },
  });
  const { data: matches } = useGetJobClaimMatches(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobClaimMatchesQueryKey(jobId) },
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const parse = useParseJobDescription();
  const tailor = useTailorJobResume();
  const cover = useDraftCoverLetter();
  const research = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/research`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Research failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Research complete" });
      qc.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
    },
    onError: (err) => toast({ title: "Research failed", description: (err as Error).message, variant: "destructive" }),
  });

  const [tab, setTab] = useState<TabId>("overview");

  if (isLoading) {
    return (
      <div className="page fade-up">
        <div className="dim" style={{ padding: 24, textAlign: "center" }}>Loading…</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page fade-up">
        <h1 className="h-display">Job not found</h1>
        <Link to="/jobs" className="btn" style={{ marginTop: 16 }}>
          <ChevronLeft size={13} /> Back to pipeline
        </Link>
      </div>
    );
  }

  const fitScore = computeFitScore(matches ?? []);

  return (
    <div className="page fade-up" style={{ maxWidth: 1180 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22 }}>
        <CompanyMark name={job.company ?? job.title} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {[job.company, job.location].filter(Boolean).join(" · ")}
          </div>
          <h1 className="h-display" style={{ fontSize: 28 }}>{job.title}</h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <StatusChip status={job.status} />
            <span className="mono dim" style={{ fontSize: 12.5 }}>
              {salaryRange(job.salaryMin, job.salaryMax)}
            </span>
            <span className="dim" style={{ fontSize: 12.5 }}>
              · Added {new Date(job.createdAt).toLocaleDateString()}
            </span>
            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="dim mono"
                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <ExternalLink size={11} /> source
              </a>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {fitScore != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <ScoreRing value={fitScore} size={64} stroke={5} />
              <span className="label">Fit</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => parse.mutate({ id: jobId, data: {} })}
              disabled={parse.isPending}
            >
              <Sparkles size={13} />
              {parse.isPending ? "Parsing…" : "Re-parse JD"}
            </button>
            <button
              type="button"
              className="btn accent"
              onClick={() => tailor.mutate({ id: jobId, data: {} })}
              disabled={tailor.isPending}
            >
              <FileText size={13} />
              {tailor.isPending ? "Drafting…" : "Tailor resume"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => cover.mutate({ id: jobId, data: {} })}
              disabled={cover.isPending}
            >
              <FileText size={13} />
              {cover.isPending ? "Drafting…" : "Draft cover letter"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 22 }}>
        {[
          { id: "overview" as const, label: "Overview" },
          { id: "claims" as const, label: "Claim matches", count: matches?.length ?? 0 },
          { id: "research" as const, label: "Research" },
          { id: "audit" as const, label: "Audit" },
        ].map((t) => (
          <div
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {"count" in t && t.count != null && (
              <span className="mono dim" style={{ marginLeft: 6, fontSize: 11 }}>
                {t.count}
              </span>
            )}
          </div>
        ))}
      </div>

      {tab === "overview" && <OverviewTab job={job as Job} />}
      {tab === "claims" && <ClaimsTab matches={(matches ?? []) as ClaimMatch[]} />}
      {tab === "research" && (
        <ResearchTab
          job={job as Job}
          onRefresh={() => research.mutate()}
          pending={research.isPending}
        />
      )}
      {tab === "audit" && <AuditTab jobId={jobId} />}
    </div>
  );
}

function OverviewTab({ job }: { job: Job }) {
  const keywords = job.parsedKeywords ?? [];
  const requirements = job.parsedRequiredSkills ?? [];
  const responsibilities = job.parsedResponsibilities ?? [];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="quiet-card">
          <div className="quiet-card-header">
            <h2 className="quiet-card-title">Job description, parsed</h2>
            <span className="dim mono" style={{ fontSize: 11 }}>jd_parsing</span>
          </div>
          <div
            className="quiet-card-body"
            style={{ display: "flex", flexDirection: "column", gap: 22 }}
          >
            <Facet label="Keywords">
              {keywords.length === 0 ? (
                <span className="dim">No keywords yet — run "Re-parse JD".</span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {keywords.map((k, i) => (
                    <span key={i} className="chip">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </Facet>
            <Facet label="Requirements">
              <BulletList items={requirements} dotColor="var(--ink-4)" />
            </Facet>
            <Facet label="Responsibilities">
              <BulletList items={responsibilities} dotColor="var(--accent)" />
            </Facet>
          </div>
        </div>

        {job.rawJdText && (
          <div className="quiet-card">
            <div className="quiet-card-header">
              <h2 className="quiet-card-title">Full text</h2>
            </div>
            <div
              className="quiet-card-body"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--ink-2)",
                background: "var(--paper-2)",
                borderRadius: 8,
                padding: 22,
                maxHeight: 320,
                overflow: "auto",
                margin: 8,
                whiteSpace: "pre-wrap",
              }}
            >
              {job.rawJdText}
            </div>
          </div>
        )}
      </div>

      <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="quiet-card flat">
          <div
            className="quiet-card-body"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <span className="label">Pipeline</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Saved", "Parsed", "Tailored", "Approved", "Applied"].map((step, i) => {
                const here = pipelinePositionForStatus(job.status) === i;
                const done = pipelinePositionForStatus(job.status) > i;
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 99,
                        background: done ? "var(--success)" : "var(--paper-3)",
                        color: done ? "white" : "var(--ink-3)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        border: `1px solid ${done ? "var(--success)" : "var(--line)"}`,
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: here ? "var(--ink)" : "var(--ink-3)",
                        fontWeight: here ? 500 : 400,
                      }}
                    >
                      {step}
                      {here && (
                        <span className="dim mono" style={{ fontSize: 11, marginLeft: 6 }}>
                          ← you are here
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="quiet-card"
          style={{ background: "var(--accent-bg)", borderColor: "var(--accent-line)" }}
        >
          <div className="quiet-card-body" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "var(--accent)" }}>
                <Sparkles size={14} />
              </span>
              <span className="label" style={{ color: "var(--accent-ink)" }}>
                Next step
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--accent-ink)", lineHeight: 1.5 }}>
              Tailor a resume against this JD. The copilot will cite your verified claims and
              flag missing keywords.
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ClaimsTab({ matches }: { matches: ClaimMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="quiet-card">
        <div className="quiet-card-body" style={{ padding: 32, textAlign: "center" }}>
          <span className="dim">No claim matches yet. Parse the JD first.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="quiet-card">
      <div className="quiet-card-header">
        <h2 className="quiet-card-title">Claims ranked by relevance</h2>
        <span className="dim" style={{ fontSize: 12 }}>From your truth-lock ledger</span>
      </div>
      <div>
        {matches.map((m, i, arr) => (
          <div
            key={m.claim.id}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 200px 90px",
              alignItems: "center",
              gap: 14,
              padding: "13px 18px",
              borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line-soft)",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}
            >
              #{m.claim.id}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
                {m.claim.summary}
              </div>
              {m.matchedKeywords.length > 0 && (
                <div
                  className="dim"
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                  }}
                >
                  matched: {m.matchedKeywords.map((k, j) => (
                    <span key={j} className="chip ghost" style={{ fontSize: 10.5, padding: "1px 6px" }}>
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="chip ghost">{m.matchType}</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <div style={{ width: 60 }}>
                <div className="bar">
                  <i style={{ width: `${Math.round(m.score * 100)}%` }} />
                </div>
              </div>
              <span className="mono" style={{ fontSize: 12, width: 28, textAlign: "right" }}>
                {Math.round(m.score * 100)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchTab({
  job,
  onRefresh,
  pending,
}: {
  job: Job;
  onRefresh: () => void;
  pending: boolean;
}) {
  const research = (job.researchData ?? {}) as Record<string, unknown>;
  const entries: Array<[string, unknown]> = Object.entries(research).slice(0, 8);
  return (
    <div className="quiet-card">
      <div className="quiet-card-header">
        <h2 className="quiet-card-title">Company research</h2>
        <button type="button" className="btn ghost" onClick={onRefresh} disabled={pending}>
          <Sparkles size={13} /> {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div
        className="quiet-card-body"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
      >
        {entries.length === 0 && (
          <div className="dim" style={{ gridColumn: "1 / -1", padding: 16 }}>
            No research yet — click Refresh.
          </div>
        )}
        {entries.map(([k, v]) => (
          <div
            key={k}
            style={{
              padding: "12px 14px",
              border: "1px solid var(--line-soft)",
              borderRadius: 10,
              background: "var(--paper-2)",
            }}
          >
            <div className="label" style={{ marginBottom: 4 }}>
              {k}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
              {String(v ?? "")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTab({ jobId }: { jobId: number }) {
  return (
    <div className="quiet-card">
      <div className="quiet-card-header">
        <h2 className="quiet-card-title">Audit trail</h2>
        <Link to={`/event-logs?jobId=${jobId}`} className="btn ghost" style={{ fontSize: 12 }}>
          <ExternalLink size={12} /> Open in logs
        </Link>
      </div>
      <div className="quiet-card-body">
        <span className="dim" style={{ fontSize: 13 }}>
          Audit trail lives in <span className="mono">event_logs</span> — filterable by job id.
        </span>
      </div>
    </div>
  );
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, dotColor }: { items: string[]; dotColor: string }) {
  if (items.length === 0) return <span className="dim">—</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((r, i) => (
        <li
          key={i}
          style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5 }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 99,
              background: dotColor,
              marginTop: 8,
              flexShrink: 0,
            }}
          />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

function salaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  const fmt = (n?: number | null) => (n ? `${Math.round(n / 1000)}k` : "?");
  if (min && max) return `$${fmt(min)}–${fmt(max)}`;
  return `$${fmt(min ?? max)}`;
}

function computeFitScore(matches: Array<{ score: number }>): number | null {
  if (matches.length === 0) return null;
  const avg = matches.reduce((s, m) => s + m.score, 0) / matches.length;
  return Math.round(avg * 100);
}

function pipelinePositionForStatus(status: string): number {
  switch (status) {
    case "new":
    case "saved":
      return 0;
    case "parsing":
    case "parsed":
    case "scored":
      return 1;
    case "tailoring":
    case "drafting":
    case "ready":
      return 2;
    case "applied":
      return 4;
    case "interviewing":
    case "interview":
      return 4;
    default:
      return 0;
  }
}
