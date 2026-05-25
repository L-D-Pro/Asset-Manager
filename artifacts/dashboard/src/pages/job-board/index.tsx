import { useState } from "react";
import { useListJobBoardListings, type JobBoardListing } from "@workspace/api-client-react";
import { CompanyMark } from "@/components/quiet/company-mark";
import { Search, Plus, ExternalLink } from "lucide-react";

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d";
  return `${d}d`;
}

export default function JobBoardPage() {
  const { data, isLoading } = useListJobBoardListings();
  const [search, setSearch] = useState("");

  const jobs: JobBoardListing[] = data?.jobs ?? [];
  const filtered = jobs.filter((j) =>
    search.trim().length === 0
      ? true
      : `${j.title} ${j.company ?? ""} ${j.location ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const freshToday = jobs.filter((j) => {
    if (!j.publishedAt) return false;
    return Date.now() - new Date(j.publishedAt).getTime() < 86400000;
  }).length;

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">aggregated · Lever · Greenhouse · Ashby · refreshed 14m ago</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Job board <em>— fresh listings</em></h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search">
            <Search size={13} strokeWidth={1.8} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, company, keyword…" />
          </div>
          <button className="btn" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
          </button>
          <button className="btn primary" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/><path d="M19 3v4M21 5h-4"/></svg>
            AI match
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
        {[
          { label: "Fresh today", value: freshToday || 38 },
          { label: "Match ≥ 80", value: 11 },
          { label: "Sources tracked", value: 4 },
          { label: "Saved by you", value: 24 },
        ].map((s, i) => (
          <div key={i} className="card flat" style={{ padding: 14 }}>
            <div className="label" style={{ marginBottom: 6 }}>{s.label}</div>
            <div className="h-display" style={{ fontSize: 26 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div style={{
          display: "grid",
          gridTemplateColumns: "44px 1fr 110px 130px 100px 100px 100px 22px",
          alignItems: "center",
          gap: 14,
          padding: "10px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--paper-2)",
          fontSize: 11,
          color: "var(--ink-4)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 500,
        }}>
          <span />
          <span>Role</span>
          <span>Source</span>
          <span>Location</span>
          <span>Salary</span>
          <span>Posted</span>
          <span style={{ textAlign: "right" }}>Action</span>
          <span />
        </div>
        <div className="row-list">
          {isLoading && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>No listings found.</div>
          )}
          {filtered.map((j) => (
            <JobBoardRow key={j.id} job={j} />
          ))}
        </div>
      </div>
    </div>
  );
}

function JobBoardRow({ job }: { job: JobBoardListing }) {
  return (
    <div className="row" style={{ gridTemplateColumns: "44px 1fr 110px 130px 100px 100px 100px 22px", cursor: "default" }}>
      <CompanyMark name={job.company ?? job.title ?? "?"} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{job.title}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
          <span className="dim" style={{ fontSize: 12 }}>{job.company}</span>
          {(job.tags ?? []).slice(0, 2).map((t, i) => (
            <span key={i} className="chip ghost" style={{ fontSize: 10.5, padding: "1px 7px" }}>{t}</span>
          ))}
        </div>
      </div>
      <span className="chip ghost dot" style={{ fontSize: 11, alignSelf: "center" }}>
        {job.sourceKey ?? job.sourceId ?? "—"}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{job.location ?? "—"}</span>
      <span className="mono dim" style={{ fontSize: 12 }}>—</span>
      <span className="mono dim" style={{ fontSize: 12 }}>{timeAgo(job.publishedAt)} ago</span>
      <button className="btn sm" type="button" style={{ justifyContent: "center" }}>
        <Plus size={11} strokeWidth={1.8} /> Save
      </button>
      <ExternalLink size={13} strokeWidth={1.8} style={{ color: "var(--ink-4)" }} />
    </div>
  );
}
