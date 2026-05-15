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
    <div>
      <div>
        <div>
          <h1>
            Jobs <em>· pipeline</em>
          </h1>
          <div>
            The spine. Everything tailored hangs off a job.
          </div>
        </div>
        <div>
          <div>
            <Search size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a job…"
            />
          </div>
          <button type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            New job
          </button>
        </div>
      </div>

      <div>
        {TABS.map((t) => (
          <div
            key={t.id}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            <span>
              {counts[t.id] ?? 0}
            </span>
          </div>
        ))}
      </div>

      <div>
        <div>
          <span />
          <span>Role</span>
          <span>Location</span>
          <span>Salary</span>
          <span>Status</span>
          <span>Added</span>
          <span>Fit</span>
          <span />
        </div>
        <div>
          {isLoading && (
            <div>
              Loading…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div>
              No jobs match.{" "}
              <button type="button" onClick={() => setCreateOpen(true)}>
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
    >
      <CompanyMark name={job.company ?? job.title ?? "?"} />
      <div>
        <div>
          {job.title}
        </div>
        <div>
          {job.company}
        </div>
      </div>
      <span>{job.location ?? "—"}</span>
      <span>
        {salaryRange(job.salaryMin, job.salaryMax)}
      </span>
      <StatusChip status={job.status} />
      <span>
        {new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
      <span>
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
    <div onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>New job</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>
        <div>
          <FieldLabel label="Title">
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Staff Software Engineer"
            />
          </FieldLabel>
          <FieldLabel label="Company">
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Linear"
            />
          </FieldLabel>
          <FieldLabel label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote · US"
            />
          </FieldLabel>
          <FieldLabel label="Job description (optional)">
            <textarea
              value={rawJdText}
              onChange={(e) => setRawJdText(e.target.value)}
              rows={6}
              placeholder="Paste the full JD here for the AI to parse later."
            />
          </FieldLabel>
        </div>
        <div>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={createJob.isPending}>
            <Plus size={13} /> Add
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}
