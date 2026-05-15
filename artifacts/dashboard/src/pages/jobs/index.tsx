import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  useListJobs,
  useCreateJob,
  getListJobsQueryKey,
  type Job,
} from "@workspace/api-client-react";

import { CompanyMark } from "@/components/quiet/company-mark";
import { StatusChip } from "@/components/quiet/status-chip";
import { Search, Plus, ChevronRight, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TABS: Array<{ id: string; label: string; match: (status: string) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  {
    id: "saved",
    label: "Saved",
    match: (s) => s === "new" || s === "parsed" || s === "parsing" || s === "scored" || s === "ready",
  },
  { id: "applied", label: "Applied", match: (s) => s === "applied" },
  { id: "interviewing", label: "Interviewing", match: (s) => s === "interviewing" || s === "interview" },
  { id: "closed", label: "Closed", match: (s) => s === "rejected" || s === "archived" || s === "closed" },
];

function salaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  const fmt = (n?: number | null) => (n ? `${Math.round(n / 1000)}k` : "?");
  if (min && max) return `$${fmt(min)}–${fmt(max)}`;
  return `$${fmt(min ?? max)}`;
}

export default function JobsPage() {
  const { data: jobs, isLoading } = useListJobs();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0]!;
  const filtered = (jobs ?? [])
    .filter((j) => tab.match(j.status))
    .filter((j) =>
      search.trim().length === 0
        ? true
        : `${j.title} ${j.company} ${j.location ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
    );

  const counts: Record<string, number> = {};
  for (const t of TABS) counts[t.id] = (jobs ?? []).filter((j) => t.match(j.status)).length;

  return (
    <div className="page fade-up">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 22,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="h-display">
            Jobs <em>· pipeline</em>
          </h1>
          <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>
            The spine. Everything tailored hangs off a job.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "var(--paper-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-sm)",
              minWidth: 240,
            }}
          >
            <Search size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a job…"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: 13,
                color: "var(--ink)",
              }}
            />
          </div>
          <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            New job
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <div
            key={t.id}
            className={`tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            <span className="mono dim" style={{ marginLeft: 6, fontSize: 11 }}>
              {counts[t.id] ?? 0}
            </span>
          </div>
        ))}
      </div>

      <div className="quiet-card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 160px 140px 120px 110px 70px 22px",
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
          }}
        >
          <span />
          <span>Role</span>
          <span>Location</span>
          <span>Salary</span>
          <span>Status</span>
          <span>Added</span>
          <span style={{ textAlign: "right" }}>Fit</span>
          <span />
        </div>
        <div>
          {isLoading && (
            <div className="dim" style={{ padding: 24, textAlign: "center" }}>
              Loading…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="dim" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>
              No jobs match.{" "}
              <button type="button" className="btn ghost" onClick={() => setCreateOpen(true)}>
                <Plus size={12} /> Add the first
              </button>
            </div>
          )}
          {filtered.map((j, i) => (
            <JobRow key={j.id} job={j} last={i === filtered.length - 1} />
          ))}
        </div>
      </div>

      {createOpen && <CreateJobSheet onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function JobRow({ job, last }: { job: Job; last: boolean }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/jobs/${job.id}`)}
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr 160px 140px 120px 110px 70px 22px",
        alignItems: "center",
        gap: 14,
        padding: "13px 18px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        cursor: "pointer",
      }}
    >
      <CompanyMark name={job.company ?? job.title ?? "?"} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: 14,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {job.title}
        </div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>
          {job.company}
        </div>
      </div>
      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{job.location ?? "—"}</span>
      <span className="mono dim" style={{ fontSize: 12.5 }}>
        {salaryRange(job.salaryMin, job.salaryMax)}
      </span>
      <StatusChip status={job.status} />
      <span className="dim mono" style={{ fontSize: 12 }}>
        {new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
      <span className="dim mono" style={{ fontSize: 13, textAlign: "right" }}>
        —
      </span>
      <ChevronRight size={14} />
    </div>
  );
}

function CreateJobSheet({ onClose }: { onClose: () => void }) {
  const createJob = useCreateJob();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [rawJdText, setRawJdText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !company.trim()) return;
    createJob.mutate(
      { data: { title: title.trim(), company: company.trim(), location: location.trim() || null, rawJdText: rawJdText.trim() || null, status: "new" } },
      {
        onSuccess: () => {
          toast({ title: "Job added" });
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          onClose();
        },
        onError: (err) => {
          toast({
            title: "Couldn't add job",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(40, 35, 30, 0.18)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="quiet-card"
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "min(640px, 86vh)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <div className="quiet-card-header">
          <h2 className="quiet-card-title">New job</h2>
          <button type="button" className="btn ghost" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>
        <div className="quiet-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldLabel label="Title">
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              style={inputStyle}
              placeholder="e.g. Staff Software Engineer"
            />
          </FieldLabel>
          <FieldLabel label="Company">
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="input"
              style={inputStyle}
              placeholder="Linear"
            />
          </FieldLabel>
          <FieldLabel label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input"
              style={inputStyle}
              placeholder="Remote · US"
            />
          </FieldLabel>
          <FieldLabel label="Job description (optional)">
            <textarea
              value={rawJdText}
              onChange={(e) => setRawJdText(e.target.value)}
              rows={6}
              className="input"
              style={{ ...inputStyle, fontFamily: "var(--font-ui)", resize: "vertical" }}
              placeholder="Paste the full JD here for the AI to parse later."
            />
          </FieldLabel>
        </div>
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={createJob.isPending}>
            <Plus size={13} /> Add
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink)",
  outline: "none",
};
