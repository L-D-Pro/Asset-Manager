import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListResumeVersions,
  useApproveResumeVersion,
  useRejectResumeVersion,
  useDeleteResumeVersion,
  getListResumeVersionsQueryKey,
  type ResumeVersion,
} from "@workspace/api-client-react";
import { ChevronDown, ChevronRight, Check, X, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiffData {
  addedBullets?: string[];
  removedBullets?: string[];
  reorderedSections?: string[];
  summary?: string;
}

const TABS: Array<{ id: string; label: string; match: (s: string) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "pending", label: "Pending", match: (s) => s === "pending_approval" || s === "draft" || s === "pending" },
  { id: "approved", label: "Approved", match: (s) => s === "approved" },
  { id: "rejected", label: "Rejected", match: (s) => s === "rejected" },
];

export default function ResumeVersionsPage() {
  const { data: versions = [], isLoading } = useListResumeVersions();
  const [activeTab, setActiveTab] = useState("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0]!;
  const filtered = versions.filter((v) => tab.match(v.status));
  const counts = Object.fromEntries(TABS.map((t) => [t.id, versions.filter((v) => t.match(v.status)).length]));

  return (
    <div className="page fade-up" style={{ maxWidth: 1280 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">all gated AI outputs · awaiting your explicit decision</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>
            Resume review <em>· truth-locked drafts</em>
          </h1>
          <div className="dim" style={{ fontSize: 13, marginTop: 6, maxWidth: 540 }}>
            Every AI-tailored resume needs your explicit nod. Approve to unlock export and application attachment.
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <div
            key={t.id}
            className={`tab${activeTab === t.id ? " active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            <span className="mono dim" style={{ marginLeft: 6, fontSize: 11 }}>{counts[t.id] ?? 0}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span className="dim mono" style={{ fontSize: 11, padding: "8px 4px" }}>
          {versions.length} total
        </span>
      </div>

      {isLoading && (
        <div className="card flat" style={{ padding: "32px 18px", textAlign: "center" }}>
          <div className="dim" style={{ fontSize: 13 }}>Loading…</div>
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div className="card flat" style={{ padding: "40px 18px", textAlign: "center" }}>
          <div className="dim" style={{ fontSize: 13 }}>
            No resume versions in this state.{" "}
            <Link to="/jobs" style={{ color: "var(--accent)" }}>Tailor one from a job</Link>.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((v) => (
          <VersionCard
            key={v.id}
            version={v}
            expanded={expandedId === v.id}
            onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
          />
        ))}
      </div>
    </div>
  );
}

function VersionCard({
  version,
  expanded,
  onToggle,
}: {
  version: ResumeVersion;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const approve = useApproveResumeVersion();
  const reject = useRejectResumeVersion();
  const remove = useDeleteResumeVersion();

  const diff = (version.diffData ?? {}) as DiffData;
  const adds = diff.addedBullets?.length ?? 0;
  const dels = diff.removedBullets?.length ?? 0;
  const cites = version.claimIds?.length ?? 0;

  function refresh() {
    qc.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
  }

  function onApprove() {
    approve.mutate(
      { id: version.id, data: {} },
      {
        onSuccess: () => { toast({ title: "Approved" }); refresh(); },
        onError: (err) => toast({ title: "Couldn't approve", description: (err as Error).message, variant: "destructive" }),
      },
    );
  }

  function onReject() {
    reject.mutate(
      { id: version.id, data: {} },
      {
        onSuccess: () => { toast({ title: "Rejected" }); refresh(); },
        onError: (err) => toast({ title: "Couldn't reject", description: (err as Error).message, variant: "destructive" }),
      },
    );
  }

  function onDelete() {
    if (!window.confirm("Delete this version?")) return;
    remove.mutate(
      { id: version.id },
      {
        onSuccess: () => { toast({ title: "Deleted" }); refresh(); },
        onError: (err) => toast({ title: "Couldn't delete", description: (err as Error).message, variant: "destructive" }),
      },
    );
  }

  const isPending = version.status === "pending_approval" || version.status === "pending" || version.status === "draft";

  const statusChip =
    version.status === "approved" ? (
      <span className="chip success dot" style={{ fontSize: 10.5 }}>approved</span>
    ) : version.status === "rejected" ? (
      <span className="chip danger dot" style={{ fontSize: 10.5 }}>rejected</span>
    ) : (
      <span className="chip warn dot" style={{ fontSize: 10.5 }}>pending approval</span>
    );

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Row header */}
      <div
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: "1fr auto auto auto auto",
          alignItems: "center", gap: 14, padding: "14px 18px",
          cursor: "pointer",
        }}
        role="button"
        aria-expanded={expanded}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>
              {version.label ?? `Resume version #${version.id}`}
            </span>
            {version.jobId && (
              <Link
                to={`/jobs/${version.jobId}`}
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 12, color: "var(--accent)" }}
              >
                · job #{version.jobId}
              </Link>
            )}
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 3, fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--diff-add-ink, #4caf50)" }}>+{adds}</span>
            {" / "}
            <span style={{ color: "var(--diff-del-ink, #f44336)" }}>−{dels}</span>
            {" · "}
            {cites} citation{cites === 1 ? "" : "s"}
            {" · "}
            {new Date(version.createdAt).toLocaleString()}
          </div>
        </div>
        {statusChip}
        <span className="mono dim" style={{ fontSize: 12 }}>
          {version.templateId ?? "—"}
        </span>
        <span className="mono dim" style={{ fontSize: 11.5 }}>#{version.id}</span>
        <span style={{ color: "var(--ink-4)" }}>
          {expanded ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 300px", gap: 0,
          borderTop: "1px solid var(--line-soft)",
        }}>
          {/* Diff panel */}
          <div style={{ padding: "16px 18px", minWidth: 0, borderRight: "1px solid var(--line-soft)" }}>
            {diff.summary && (
              <p className="dim" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>{diff.summary}</p>
            )}

            <div className="diff" style={{ fontFamily: "var(--font-mono)" }}>
              <div className="diff-h">
                <span>
                  <span className="filename">{version.label ?? `resume-v${version.id}.md`}</span>
                  {version.jobId && <span className="dim"> · tailored for job #{version.jobId}</span>}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                  <span style={{ color: "var(--diff-add-ink, #4caf50)" }}>+{adds}</span>
                  {" / "}
                  <span style={{ color: "var(--diff-del-ink, #f44336)" }}>−{dels}</span>
                </span>
              </div>
              <div>
                {(diff.addedBullets ?? []).map((line, i) => (
                  <div key={`add-${i}`} className="diff-row add">
                    <div className="ln" />
                    <div className="ln">{i + 1}</div>
                    <div className="content">{line}</div>
                  </div>
                ))}
                {(diff.removedBullets ?? []).map((line, i) => (
                  <div key={`del-${i}`} className="diff-row del">
                    <div className="ln">{i + 1}</div>
                    <div className="ln" />
                    <div className="content">{line}</div>
                  </div>
                ))}
                {adds === 0 && dels === 0 && (
                  <div className="diff-row ctx">
                    <div className="ln" />
                    <div className="ln" />
                    <div className="content dim" style={{ fontStyle: "italic" }}>No structured diff available.</div>
                  </div>
                )}
              </div>
            </div>

            {version.tailoredDocumentText && (
              <details style={{ marginTop: 12 }}>
                <summary className="dim" style={{ fontSize: 12.5, cursor: "pointer", userSelect: "none" }}>
                  Full rendered text
                </summary>
                <pre style={{
                  marginTop: 8, padding: 12, borderRadius: "var(--r-md)",
                  background: "var(--paper-2)", fontSize: 11.5, lineHeight: 1.6,
                  overflowX: "auto", color: "var(--ink-2)", fontFamily: "var(--font-mono)",
                  whiteSpace: "pre-wrap",
                }}>
                  {version.tailoredDocumentText}
                </pre>
              </details>
            )}
          </div>

          {/* Sidebar */}
          <aside style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ marginBottom: 10 }}>{statusChip}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  className="btn accent"
                  style={{ width: "100%", justifyContent: "center", opacity: !isPending ? 0.4 : 1 }}
                  onClick={onApprove}
                  disabled={!isPending || approve.isPending}
                >
                  <Check size={14} strokeWidth={2} />
                  {approve.isPending ? "Approving…" : "Approve"}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ width: "100%", justifyContent: "center", opacity: !isPending ? 0.4 : 1 }}
                  onClick={onReject}
                  disabled={!isPending || reject.isPending}
                >
                  <X size={13} strokeWidth={2} />
                  {reject.isPending ? "Rejecting…" : "Reject"}
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ width: "100%", justifyContent: "center", color: "var(--ink-4)" }}
                  onClick={onDelete}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            <div className="card flat" style={{ padding: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>What happens on approve</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: "var(--ink-2)", fontSize: 12.5, lineHeight: 1.65 }}>
                <li>Version moves to <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>approved</code>.</li>
                <li>DOCX + PDF export unlocked.</li>
                <li>Attachable to an application.</li>
                <li>Logged with runId for lineage.</li>
              </ul>
            </div>

            {cites > 0 && (
              <div style={{
                display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px",
                borderRadius: "var(--r-md)", background: "var(--accent-bg)",
                border: "1px solid var(--accent-line)",
              }}>
                <Shield size={13} strokeWidth={1.8} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "var(--accent-ink)", lineHeight: 1.5 }}>
                  {cites} claim{cites === 1 ? "" : "s"} cited from your verified ledger.
                </span>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
