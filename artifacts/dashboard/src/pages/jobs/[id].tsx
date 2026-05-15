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
      <div>
        <div>Loading…</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div>
        <h1>Job not found</h1>
        <Link to="/jobs">
          <ChevronLeft size={13} /> Back to pipeline
        </Link>
      </div>
    );
  }

  const fitScore = computeFitScore(matches ?? []);

  return (
    <div>
      <div>
        <CompanyMark name={job.company ?? job.title} size={44} />
        <div>
          <div>
            {[job.company, job.location].filter(Boolean).join(" · ")}
          </div>
          <h1>{job.title}</h1>
          <div>
            <StatusChip status={job.status} />
            <span>
              {salaryRange(job.salaryMin, job.salaryMax)}
            </span>
            <span>
              · Added {new Date(job.createdAt).toLocaleDateString()}
            </span>
            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={11} /> source
              </a>
            )}
          </div>
        </div>
        <div>
          {fitScore != null && (
            <div>
              <ScoreRing value={fitScore} size={64} stroke={5} />
              <span>Fit</span>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => parse.mutate({ id: jobId, data: {} })}
              disabled={parse.isPending}
            >
              <Sparkles size={13} />
              {parse.isPending ? "Parsing…" : "Re-parse JD"}
            </button>
            <button
              type="button"
              onClick={() => tailor.mutate({ id: jobId, data: {} })}
              disabled={tailor.isPending}
            >
              <FileText size={13} />
              {tailor.isPending ? "Drafting…" : "Tailor resume"}
            </button>
            <button
              type="button"
              onClick={() => cover.mutate({ id: jobId, data: {} })}
              disabled={cover.isPending}
            >
              <FileText size={13} />
              {cover.isPending ? "Drafting…" : "Draft cover letter"}
            </button>
          </div>
        </div>
      </div>

      <div>
        {[
          { id: "overview" as const, label: "Overview" },
          { id: "claims" as const, label: "Claim matches", count: matches?.length ?? 0 },
          { id: "research" as const, label: "Research" },
          { id: "audit" as const, label: "Audit" },
        ].map((t) => (
          <div
            key={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {"count" in t && t.count != null && (
              <span>
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
    <div>
      <div>
        <div>
          <div>
            <h2>Job description, parsed</h2>
            <span>jd_parsing</span>
          </div>
          <div>
            <Facet label="Keywords">
              {keywords.length === 0 ? (
                <span>No keywords yet — run "Re-parse JD".</span>
              ) : (
                <div>
                  {keywords.map((k, i) => (
                    <span key={i}>
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </Facet>
            <Facet label="Requirements">
              <BulletList items={requirements} />
            </Facet>
            <Facet label="Responsibilities">
              <BulletList items={responsibilities} />
            </Facet>
          </div>
        </div>

        {job.rawJdText && (
          <div>
            <div>
              <h2>Full text</h2>
            </div>
            <div>
              {job.rawJdText}
            </div>
          </div>
        )}
      </div>

      <aside>
        <div>
          <div>
            <span>Pipeline</span>
            <div>
              {["Saved", "Parsed", "Tailored", "Approved", "Applied"].map((step, i) => {
                const here = pipelinePositionForStatus(job.status) === i;
                const done = pipelinePositionForStatus(job.status) > i;
                return (
                  <div key={step}>
                    <span>
                      {done ? "✓" : i + 1}
                    </span>
                    <span>
                      {step}
                      {here && (
                        <span>
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

        <div>
          <div>
            <div>
              <span>
                <Sparkles size={14} />
              </span>
              <span>
                Next step
              </span>
            </div>
            <div>
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
      <div>
        <div>
          <span>No claim matches yet. Parse the JD first.</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div>
        <h2>Claims ranked by relevance</h2>
        <span>From your truth-lock ledger</span>
      </div>
      <div>
        {matches.map((m, i, arr) => (
          <div
            key={m.claim.id}
          >
            <span>
              #{m.claim.id}
            </span>
            <div>
              <div>
                {m.claim.summary}
              </div>
              {m.matchedKeywords.length > 0 && (
                <div>
                  matched: {m.matchedKeywords.map((k, j) => (
                    <span key={j}>
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <span>{m.matchType}</span>
            </div>
            <div>
              <div>
                <div>
                  <i />
                </div>
              </div>
              <span>
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
    <div>
      <div>
        <h2>Company research</h2>
        <button type="button" onClick={onRefresh} disabled={pending}>
          <Sparkles size={13} /> {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div>
        {entries.length === 0 && (
          <div>
            No research yet — click Refresh.
          </div>
        )}
        {entries.map(([k, v]) => (
          <div key={k}>
            <div>
              {k}
            </div>
            <div>
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
    <div>
      <div>
        <h2>Audit trail</h2>
        <Link to={`/event-logs?jobId=${jobId}`}>
          <ExternalLink size={12} /> Open in logs
        </Link>
      </div>
      <div>
        <span>
          Audit trail lives in event_logs — filterable by job id.
        </span>
      </div>
    </div>
  );
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div>
        {label}
      </div>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <span>—</span>;
  return (
    <ul>
      {items.map((r, i) => (
        <li key={i}>
          <span />
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
