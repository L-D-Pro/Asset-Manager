import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useListResumeVersions, useListCoverLetterVersions, type ResumeVersion, type CoverLetterVersion } from "@workspace/api-client-react";
import { ChevronRight, Filter, Shield } from "lucide-react";
import { format } from "date-fns";

type ReviewItem = {
  id: string;
  kind: "resume" | "cover_letter";
  title: string;
  jobId?: number | null;
  status: string;
  citations: number;
  createdAt: string;
};

function toReviewItems(resumes: ResumeVersion[], coverLetters: CoverLetterVersion[]): ReviewItem[] {
  const r = resumes
    .filter((v) => v.status === "pending_approval")
    .map((v): ReviewItem => ({
      id: `r-${v.id}`,
      kind: "resume",
      title: v.label ?? `Resume v${v.id}`,
      jobId: v.jobId,
      status: v.status,
      citations: v.claimIds.length,
      createdAt: v.createdAt,
    }));
  const c = coverLetters
    .filter((v) => v.status === "pending_approval")
    .map((v): ReviewItem => ({
      id: `c-${v.id}`,
      kind: "cover_letter",
      title: v.label ?? `Cover letter v${v.id}`,
      jobId: v.jobId,
      status: v.status,
      citations: v.claimIds.length,
      createdAt: v.createdAt,
    }));
  return [...r, ...c].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function ReviewQueuePage() {
  const { data: resumes = [] } = useListResumeVersions();
  const { data: coverLetters = [] } = useListCoverLetterVersions();
  const [filter, setFilter] = useState<"all" | "resume" | "cover_letter">("all");
  const navigate = useNavigate();

  const items = toReviewItems(resumes, coverLetters);
  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);

  const counts = {
    all: items.length,
    resume: items.filter((i) => i.kind === "resume").length,
    cover_letter: items.filter((i) => i.kind === "cover_letter").length,
  };

  const oldest = items.length > 0 ? format(new Date(items[0]!.createdAt), "MMM d") : null;
  const newest = items.length > 0 ? format(new Date(items[items.length - 1]!.createdAt), "MMM d") : null;

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">all gated AI outputs · awaiting your explicit decision</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Review queue <em>· {items.length} pending</em></h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">
            <Filter size={13} strokeWidth={1.8} /> Sort by fit
          </button>
          <button className="btn ghost" type="button">Bulk select</button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {([
          { id: "all", label: "All", n: counts.all },
          { id: "resume", label: "Resumes", n: counts.resume },
          { id: "cover_letter", label: "Cover letters", n: counts.cover_letter },
        ] as const).map((t) => (
          <div key={t.id} className={`tab${filter === t.id ? " active" : ""}`} onClick={() => setFilter(t.id)}>
            {t.label}
            <span className="mono dim" style={{ marginLeft: 6, fontSize: 11 }}>{t.n}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {oldest && newest && (
          <span className="dim mono" style={{ fontSize: 11, padding: "8px 4px" }}>
            {items.length} pending · oldest {oldest} · newest {newest}
          </span>
        )}
      </div>

      <div className="card">
        <div className="row-list">
          {filtered.length === 0 ? (
            <div className="dim" style={{ padding: "40px 18px", textAlign: "center", fontSize: 13 }}>
              No pending items — all AI outputs reviewed.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="row"
                style={{ gridTemplateColumns: "36px 1fr 200px 100px 130px 22px" }}
                onClick={() => item.jobId && navigate(`/jobs/${item.jobId}`)}>
                <JobInitial jobId={item.jobId} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{item.title}</span>
                    <span className="chip ghost" style={{ fontSize: 10.5 }}>
                      {item.kind === "resume" ? "resume_version" : "cover_letter_version"}
                    </span>
                  </div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {item.jobId ? `Job #${item.jobId}` : "No job linked"}
                  </div>
                </div>
                <div>
                  <span className="chip warn dot">{item.status.replace(/_/g, " ")}</span>
                </div>
                <span className="mono dim" style={{ fontSize: 12 }}>{item.citations} cites</span>
                <span className="mono dim" style={{ fontSize: 11.5 }}>
                  {format(new Date(item.createdAt), "MMM d, h:mm a")}
                </span>
                <ChevronRight size={14} strokeWidth={1.8} style={{ color: "var(--ink-4)" }} />
              </div>
            ))
          )}
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--paper-2)" }}>
          <span className="dim" style={{ fontSize: 12.5 }}>
            <Shield size={12} strokeWidth={1.8} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4, color: "var(--accent)" }} />
            Approvals are always explicit. Re-approving returns 409.
          </span>
          <button className="btn ghost sm" type="button">API docs</button>
        </div>
      </div>
    </div>
  );
}

function JobInitial({ jobId }: { jobId?: number | null }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: "var(--paper-2)", border: "1px solid var(--line-soft)",
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--ink-3)",
    }}>
      {jobId ? `#${jobId}` : "–"}
    </div>
  );
}
