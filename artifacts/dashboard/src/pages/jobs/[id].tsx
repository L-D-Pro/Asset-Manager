import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  useGetJob,
  useParseJobDescription,
  useTailorJobResume,
  useResearchJob,
  useGetJobClaimMatches,
  getGetJobQueryKey,
  getGetJobClaimMatchesQueryKey,
  type Job,
  type ClaimMatch,
} from "@workspace/api-client-react";

import { MessageCircle, Sparkles } from "lucide-react";
import { CompanyMark } from "@/components/quiet/company-mark";
import { ScoreRing } from "@/components/quiet/score-ring";
import { StatusChip } from "@/components/quiet/status-chip";
import { useToast } from "@/hooks/use-toast";

type TabId = "overview" | "claims" | "research" | "versions" | "audit";

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

  const tailor = useTailorJobResume();
  const [tailoring, setTailoring] = useState(false);
  const research = useResearchJob({
    mutation: {
      onSuccess: () => {
        toast({ title: "Research complete" });
        qc.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      },
      onError: (err) => toast({ title: "Research failed", description: (err as Error).message, variant: "destructive" }),
    },
  });

  const [tab, setTab] = useState<TabId>("overview");

  const handleTailor = () => {
    setTailoring(true);
    tailor.mutate({ id: jobId, data: {} }, {
      onSuccess: () => { toast({ title: "Resume draft queued" }); setTailoring(false); },
      onError: (err) => { toast({ title: "Tailor failed", description: (err as Error).message, variant: "destructive" }); setTailoring(false); },
    });
  };

  if (isLoading) {
    return (
      <div className="page fade-up">
        <div className="dim" style={{ padding: "60px 0", textAlign: "center", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page fade-up">
        <h1 className="h-display" style={{ marginBottom: 16 }}>Job not found</h1>
      </div>
    );
  }

  const fitScore = computeFitScore(matches ?? []);

  const TABS: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "claims", label: "Claim matches", count: matches?.length ?? 0 },
    { id: "research", label: "Research" },
    { id: "versions", label: "Versions" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <div className="page fade-up" style={{ maxWidth: 1180 }}>
      {/* Hero header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22 }}>
        <CompanyMark name={job.company ?? job.title ?? "?"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {[job.company, job.location].filter(Boolean).join(" · ")}
          </div>
          <h1 className="h-display" style={{ fontSize: 28 }}>{job.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <StatusChip status={job.status} />
            <span className="mono dim" style={{ fontSize: 12.5 }}>{salaryRange(job.salaryMin, job.salaryMax)}</span>
            <span className="dim" style={{ fontSize: 12.5 }}>
              · Added {new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
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
            <button className="btn" type="button">
              <MessageCircle size={13} strokeWidth={1.8} /> Notes
            </button>
            <button className="btn accent" type="button" onClick={handleTailor} disabled={tailoring}>
              {tailoring ? (
                <><Spinner /> Drafting…</>
              ) : (
                <><Sparkles size={13} strokeWidth={1.8} /> Tailor resume</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 22 }}>
        {TABS.map((t) => (
          <div key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.count != null && (
              <span className="mono dim" style={{ marginLeft: 6, fontSize: 11 }}>{t.count}</span>
            )}
          </div>
        ))}
      </div>

      {tab === "overview"  && <OverviewTab job={job as Job} />}
      {tab === "claims"    && <ClaimsTab matches={(matches ?? []) as ClaimMatch[]} />}
      {tab === "research"  && <ResearchTab job={job as Job} onRefresh={() => research.mutate({ id: jobId })} pending={research.isPending} />}
      {tab === "versions"  && <VersionsTab jobId={jobId} />}
      {tab === "audit"     && <AuditTab jobId={jobId} />}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 12, height: 12,
      border: "1.6px solid currentColor", borderRightColor: "transparent",
      borderRadius: 99, display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

function OverviewTab({ job }: { job: Job }) {
  const keywords = job.parsedKeywords ?? [];
  const requirements = job.parsedRequiredSkills ?? [];
  const responsibilities = job.parsedResponsibilities ?? [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="card">
          <div className="card-h">
            <h2 className="card-title">Job description, parsed</h2>
            <span className="dim mono" style={{ fontSize: 11 }}>by jd_parsing</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <Facet label="Keywords">
              {keywords.length === 0 ? (
                <span className="dim" style={{ fontSize: 13 }}>No keywords yet — re-parse JD.</span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {keywords.map((k, i) => <span key={i} className="chip">{k}</span>)}
                </div>
              )}
            </Facet>
            <Facet label="Requirements">
              <BulletList items={requirements} accent={false} />
            </Facet>
            <Facet label="Responsibilities">
              <BulletList items={responsibilities} accent />
            </Facet>
          </div>
        </div>

        {job.rawJdText && (
          <div className="card">
            <div className="card-h">
              <h2 className="card-title">Full text</h2>
              <button className="btn ghost sm" type="button">
                Open source
              </button>
            </div>
            <div className="card-body" style={{
              fontFamily: "var(--font-display)",
              fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)",
              background: "var(--paper-2)", borderRadius: 8, padding: 22,
              maxHeight: 240, overflow: "hidden", position: "relative", margin: 8,
            }}>
              <p style={{ marginTop: 0 }}>{job.rawJdText.slice(0, 600)}</p>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 80, background: "linear-gradient(180deg, transparent, var(--paper-2))" }} />
            </div>
          </div>
        )}
      </div>

      <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Why you're a match */}
        <div className="card">
          <div className="card-h">
            <h2 className="card-title" style={{ fontSize: 15 }}>Why you're a match</h2>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requirements.length === 0 && (
              <div className="dim" style={{ fontSize: 12.5 }}>Parse the JD to see match reasons.</div>
            )}
            {requirements.slice(0, 2).map((r, i) => (
              <Reason key={i} kind="success" text={r} />
            ))}
            {requirements.length > 2 && (
              <Reason kind="info" text={`${requirements.length - 2} more requirements — parse full JD.`} />
            )}
          </div>
        </div>

        {/* Accent suggestion */}
        <div className="card" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-line)" }}>
          <div className="card-body" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "var(--accent)" }}><Sparkles size={14} strokeWidth={1.8} /></span>
              <span className="label" style={{ color: "var(--accent-ink)" }}>Suggestion</span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--accent-ink)", lineHeight: 1.5 }}>
              Tailor a resume now. Your verified claims are a strong fit for this JD.
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <div className="card flat">
          <div className="card-body" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="label">Pipeline</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Save", "Tailor", "Approve", "Apply", "Track outcome"].map((step, i) => {
                const pos = pipelinePositionForStatus(job.status);
                const done = pos > i;
                const here = pos === i;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 99,
                      background: done ? "var(--success)" : "var(--paper-3)",
                      color: done ? "white" : "var(--ink-3)",
                      display: "grid", placeItems: "center", fontSize: 10,
                      border: `1px solid ${done ? "var(--success)" : "var(--line)"}`,
                    }}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: here ? "var(--ink)" : "var(--ink-3)", fontWeight: here ? 500 : 400 }}>
                      {step}
                      {here && <span className="dim mono" style={{ fontSize: 11, marginLeft: 6 }}>← you are here</span>}
                    </span>
                  </div>
                );
              })}
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
      <div className="card" style={{ padding: "40px 18px", textAlign: "center" }}>
        <div className="dim" style={{ fontSize: 13 }}>No claim matches yet. Parse the JD first.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-h">
        <h2 className="card-title">Claims ranked by relevance</h2>
        <span className="dim" style={{ fontSize: 12 }}>From your truth-lock ledger</span>
      </div>
      <div className="row-list">
        {matches.map((m) => {
          const pct = Math.round(m.score * 100);
          return (
            <div key={m.claim.id} className="row" style={{ gridTemplateColumns: "60px 1fr 200px 90px", cursor: "default" }}>
              <span className="mono" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>
                #{m.claim.id}
              </span>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>{m.claim.summary}</div>
                {m.matchedKeywords.length > 0 && (
                  <div className="dim" style={{ fontSize: 12, marginTop: 6, fontStyle: "italic", fontFamily: "var(--font-display)" }}>
                    → {m.matchedKeywords.slice(0, 3).join(", ")}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="chip ghost">{m.matchType}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <div style={{ width: 60 }}>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                </div>
                <span className="mono" style={{ fontSize: 12, width: 28, textAlign: "right" }}>{pct}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResearchTab({ job, onRefresh, pending }: { job: Job; onRefresh: () => void; pending: boolean }) {
  const research = (job.researchData ?? {}) as Record<string, unknown>;
  const entries: Array<[string, unknown]> = Object.entries(research).slice(0, 6);

  return (
    <div className="card">
      <div className="card-h">
        <h2 className="card-title">Company research</h2>
        <button type="button" className="btn ghost sm" onClick={onRefresh} disabled={pending}>
          <Sparkles size={13} strokeWidth={1.8} /> {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {entries.length === 0 ? (
          <div className="dim" style={{ fontSize: 13, gridColumn: "1 / -1", textAlign: "center", padding: "24px 0" }}>
            No research yet — click Refresh.
          </div>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} style={{ padding: "12px 14px", border: "1px solid var(--line-soft)", borderRadius: 10, background: "var(--paper-2)" }}>
              <div className="label" style={{ marginBottom: 4 }}>{k}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{String(v ?? "")}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function VersionsTab({ jobId }: { jobId: number }) {
  return (
    <div className="card">
      <div className="card-h">
        <h2 className="card-title">Resume &amp; cover-letter versions</h2>
        <button className="btn primary sm" type="button">
          <Sparkles size={12} strokeWidth={1.8} /> Tailor again
        </button>
      </div>
      <div className="row-list">
        <div className="dim" style={{ padding: "40px 18px", textAlign: "center", fontSize: 13 }}>
          No versions yet for this job. Tailor a resume to get started.
        </div>
      </div>
    </div>
  );
}

function AuditTab({ jobId }: { jobId: number }) {
  return (
    <div className="card">
      <div className="card-h">
        <h2 className="card-title">Audit trail</h2>
        <span className="dim mono" style={{ fontSize: 11 }}>append-only · event_logs</span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "110px 60px 1fr 140px",
          gap: 12, alignItems: "center",
          padding: "11px 18px", borderBottom: "1px solid var(--line-soft)", fontSize: 13,
        }}>
          <span className="mono dim" style={{ fontSize: 12 }}>just now</span>
          <span className="chip ghost dot" style={{ fontSize: 10.5 }}>you</span>
          <span>Viewed job #{jobId}</span>
          <span className="mono dim" style={{ fontSize: 11.5 }} />
        </div>
        <div style={{ padding: "12px 18px" }}>
          <div className="dim" style={{ fontSize: 12.5 }}>
            Full audit trail lives in event_logs. Filter by job ID in the Event Logs page.
          </div>
        </div>
      </div>
    </div>
  );
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function BulletList({ items, accent }: { items: string[]; accent: boolean }) {
  if (items.length === 0) return <span className="dim" style={{ fontSize: 13 }}>—</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((r, i) => (
        <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5 }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: accent ? "var(--accent)" : "var(--ink-4)", marginTop: 8, flexShrink: 0 }} />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

function Reason({ kind, text }: { kind: "success" | "warn" | "info"; text: string }) {
  const label = kind === "success" ? "match" : kind === "warn" ? "gap" : "note";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.5 }}>
      <span className={`chip ${kind} dot`} style={{ padding: "2px 8px", marginTop: 1 }}>{label}</span>
      <span style={{ color: "var(--ink-2)" }}>{text}</span>
    </div>
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
    case "new": case "saved": return 0;
    case "parsing": case "parsed": case "scored": return 1;
    case "tailoring": case "drafting": case "ready": return 2;
    case "applied": return 4;
    case "interviewing": case "interview": return 4;
    default: return 0;
  }
}
