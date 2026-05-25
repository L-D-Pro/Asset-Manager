import { useState } from "react";
import { Portal } from "@/components/ui/portal";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  useListJobs,
  useCreateJob,
  useUpdateJob,
  useDeleteJob,
  getListJobsQueryKey,
  type Job,
} from "@workspace/api-client-react";

import { CompanyMark } from "@/components/quiet/company-mark";
import { StatusChip } from "@/components/quiet/status-chip";
import { Search, Plus, ChevronRight, X, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TABS: Array<{ id: string; label: string; match: (status: string) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "saved", label: "Saved", match: (s) => s === "new" || s === "parsed" || s === "parsing" || s === "scored" || s === "ready" },
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

function FitBadge({ value }: { value?: number | null }) {
  if (value == null) return <span className="mono dim" style={{ fontSize: 12, textAlign: "center" }}>—</span>;
  const color = value >= 85 ? "var(--lime)" : value >= 70 ? "var(--cyan)" : value >= 55 ? "var(--gold)" : "var(--red)";
  const bg = value >= 85 ? "var(--lime-bg)" : value >= 70 ? "var(--cyan-bg)" : value >= 55 ? "var(--gold-bg)" : "var(--red-bg)";
  const line = value >= 85 ? "var(--lime-line)" : value >= 70 ? "var(--cyan-line)" : value >= 55 ? "var(--gold-line)" : "var(--red-line)";
  return (
    <span className="mono" style={{
      fontSize: 12, color, fontWeight: 900, textAlign: "center",
      fontVariantNumeric: "tabular-nums", background: bg,
      border: `1px solid ${line}`, padding: "3px 8px", borderRadius: 6, minWidth: 38, display: "inline-block",
    }}>
      {value}
    </span>
  );
}

export default function JobsPage() {
  const { data: jobs, isLoading } = useListJobs();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 className="h-display">Jobs <em>· pipeline</em></h1>
          <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>The spine. Everything tailored hangs off a job.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search" style={{ minWidth: 240 }}>
            <Search size={13} strokeWidth={1.8} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a job…" />
            <span className="kbd">&#x2318;K</span>
          </div>
          <button className="btn" type="button">
            <ExternalLink size={13} strokeWidth={1.8} /> Paste URL
          </button>
          <button className="btn primary" type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={13} strokeWidth={1.8} /> New job
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <div key={t.id} className={`tab${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
            <span className="mono dim" style={{ marginLeft: 6, fontSize: 11 }}>{counts[t.id] ?? 0}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn ghost sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/></svg>
          Newest
        </button>
      </div>

      {/* Table */}
      <div className="card">
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "44px 1fr 160px 140px 110px 110px 80px 64px",
          alignItems: "center", gap: 14, padding: "10px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--paper-2)",
          fontSize: 11, color: "var(--ink-4)",
          textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500,
        }}>
          <span />
          <span>Role</span>
          <span>Location</span>
          <span>Salary</span>
          <span>Status</span>
          <span>Added</span>
          <span style={{ textAlign: "right" }}>Fit</span>
          <span />
        </div>
        <div className="row-list">
          {isLoading && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>
              No jobs match.{" "}
              <button className="btn ghost sm" type="button" onClick={() => setCreateOpen(true)} style={{ display: "inline-flex" }}>
                <Plus size={12} strokeWidth={1.8} /> Add the first
              </button>
            </div>
          )}
          {filtered.map((j, i) => (
            <JobRow key={j.id} job={j} last={i === filtered.length - 1} onEdit={() => setEditingJob(j)} />
          ))}
        </div>
      </div>

      {createOpen && <CreateJobSheet onClose={() => setCreateOpen(false)} />}
      {editingJob && <EditJobSheet job={editingJob} onClose={() => setEditingJob(null)} />}
    </div>
  );
}

function JobRow({ job, last, onEdit }: { job: Job; last: boolean; onEdit: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteJob = useDeleteJob();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteJob.mutateAsync({ id: job.id });
      queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
      toast({ title: "Job removed" });
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  return (
    <div
      className="row"
      style={{ gridTemplateColumns: "44px 1fr 160px 140px 110px 110px 80px 64px" }}
      onClick={() => navigate(`/jobs/${job.id}`)}>
      <CompanyMark name={job.company ?? job.title ?? "?"} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink)" }}>{job.title}</div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{job.company}</div>
      </div>
      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{job.location ?? "—"}</span>
      <span className="mono dim" style={{ fontSize: 12.5 }}>{salaryRange(job.salaryMin, job.salaryMax)}</span>
      <StatusChip status={job.status} />
      <span className="mono dim" style={{ fontSize: 12 }}>
        {new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
      <FitBadge value={(job as Job & { fitScore?: number | null }).fitScore} />
      <span style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button" className="btn ghost" style={{ padding: "3px 5px" }}
          title="Edit job" onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil size={12} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={confirmDelete ? "btn danger" : "btn ghost"}
          style={{ padding: "3px 5px", color: confirmDelete ? undefined : "var(--danger, #d73a49)" }}
          title={confirmDelete ? "Confirm delete" : "Delete job"}
          disabled={deleteJob.isPending}
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
        >
          {confirmDelete ? (deleteJob.isPending ? "…" : "✓") : <Trash2 size={12} strokeWidth={1.8} />}
        </button>
        <ChevronRight size={14} strokeWidth={1.8} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
      </span>
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
          toast({ title: "Couldn't add job", description: (err as Error).message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <Portal>
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden" }}>
        {/* Header */}
        <div className="card-h">
          <h2 className="card-title">New job</h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        {/* Fields */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <SheetField label="Title">
            <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Staff Software Engineer" />
          </SheetField>
          <SheetField label="Company">
            <input className="input" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Linear" />
          </SheetField>
          <SheetField label="Location">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote · US" />
          </SheetField>
          <SheetField label="Job description (optional)">
            <textarea className="input" value={rawJdText} onChange={(e) => setRawJdText(e.target.value)} rows={5} placeholder="Paste the full JD here for the AI to parse later." style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }} />
          </SheetField>
        </div>
        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary sm" disabled={createJob.isPending}>
            <Plus size={13} strokeWidth={1.8} /> {createJob.isPending ? "Adding…" : "Add job"}
          </button>
        </div>
      </form>
    </div>
    </Portal>
  );
}

const JOB_STATUSES = ["new", "parsed", "ready", "applied", "interviewing", "rejected", "archived"] as const;

function EditJobSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJob = useUpdateJob();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(job.title ?? "");
  const [company, setCompany] = useState(job.company ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [status, setStatus] = useState(job.status ?? "new");
  const [salaryMin, setSalaryMin] = useState(job.salaryMin != null ? String(job.salaryMin) : "");
  const [salaryMax, setSalaryMax] = useState(job.salaryMax != null ? String(job.salaryMax) : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !company.trim()) return;
    updateJob.mutate(
      {
        id: job.id,
        data: {
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || null,
          status,
          salaryMin: salaryMin ? Number(salaryMin) : null,
          salaryMax: salaryMax ? Number(salaryMax) : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Job updated" });
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          onClose();
        },
        onError: (err) => {
          toast({ title: "Couldn't update job", description: (err as Error).message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <Portal>
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden" }}>
        <div className="card-h">
          <h2 className="card-title">Edit job</h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <SheetField label="Title">
            <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </SheetField>
          <SheetField label="Company">
            <input className="input" required value={company} onChange={(e) => setCompany(e.target.value)} />
          </SheetField>
          <SheetField label="Location">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote · US" />
          </SheetField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <SheetField label="Status">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </SheetField>
            <SheetField label="Salary min">
              <input className="input" type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="e.g. 120000" />
            </SheetField>
            <SheetField label="Salary max">
              <input className="input" type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="e.g. 160000" />
            </SheetField>
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary sm" disabled={updateJob.isPending}>
            {updateJob.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
    </Portal>
  );
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
