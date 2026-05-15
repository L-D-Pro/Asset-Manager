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

import { Icon } from "@/components/quiet/icon";
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
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, versions.filter((v) => t.match(v.status)).length]),
  );

  return (
    <div className="page fade-up">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <div>
          <h1 className="h-display">
            Resume review <em>· truth-locked drafts</em>
          </h1>
          <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>
            Every AI-tailored resume needs your explicit nod. Approve to unlock export and
            application attachment.
          </div>
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

      {isLoading && (
        <div className="quiet-card" style={{ padding: 32, textAlign: "center" }}>
          <span className="dim">Loading…</span>
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div className="quiet-card" style={{ padding: 32, textAlign: "center" }}>
          <span className="dim" style={{ fontSize: 13 }}>
            No resume versions in this state.{" "}
            <Link to="/jobs" style={{ color: "var(--accent)" }}>
              Tailor one from a job
            </Link>
            .
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((v) => (
          <VersionRow
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

function VersionRow({
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
        onSuccess: () => {
          toast({ title: "Approved" });
          refresh();
        },
        onError: (err) =>
          toast({
            title: "Couldn't approve",
            description: (err as Error).message,
            variant: "destructive",
          }),
      },
    );
  }

  function onReject() {
    reject.mutate(
      { id: version.id, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Rejected" });
          refresh();
        },
        onError: (err) =>
          toast({
            title: "Couldn't reject",
            description: (err as Error).message,
            variant: "destructive",
          }),
      },
    );
  }

  function onDelete() {
    if (!window.confirm("Delete this version?")) return;
    remove.mutate(
      { id: version.id },
      {
        onSuccess: () => {
          toast({ title: "Deleted" });
          refresh();
        },
        onError: (err) =>
          toast({
            title: "Couldn't delete",
            description: (err as Error).message,
            variant: "destructive",
          }),
      },
    );
  }

  const stateChip =
    version.status === "approved" ? (
      <span className="chip success dot">approved</span>
    ) : version.status === "rejected" ? (
      <span className="chip danger dot">rejected</span>
    ) : (
      <span className="chip warn dot">pending approval</span>
    );

  return (
    <div className="quiet-card">
      <div
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 130px 70px 24px",
          gap: 16,
          alignItems: "center",
          padding: "16px 20px",
          cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {version.label ?? `Resume version #${version.id}`}
            {version.jobId && (
              <Link
                to={`/jobs/${version.jobId}`}
                onClick={(e) => e.stopPropagation()}
                className="dim mono"
                style={{ fontSize: 11 }}
              >
                · job #{version.jobId}
              </Link>
            )}
          </div>
          <div className="dim mono" style={{ fontSize: 11, marginTop: 3 }}>
            +{adds} / −{dels} · {cites} citation{cites === 1 ? "" : "s"} ·{" "}
            {new Date(version.createdAt).toLocaleString()}
          </div>
        </div>
        {stateChip}
        <span className="dim mono" style={{ fontSize: 12 }}>
          {version.templateId ?? "—"}
        </span>
        <span className="mono dim" style={{ fontSize: 11.5, textAlign: "right" }}>
          #{version.id}
        </span>
        <Icon name={expanded ? "chev-d" : "chev-r"} size={14} />
      </div>

      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--line-soft)",
            padding: 20,
            display: "grid",
            gridTemplateColumns: "1fr 280px",
            gap: 20,
          }}
        >
          <div>
            {diff.summary && (
              <p
                className="dim"
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  marginTop: 0,
                  marginBottom: 14,
                  fontStyle: "italic",
                  fontFamily: "var(--font-display)",
                }}
              >
                {diff.summary}
              </p>
            )}
            <div className="diff">
              <div className="diff-h">
                <span>
                  <span className="filename">
                    {version.label ?? `resume-v${version.id}.md`}
                  </span>
                  {version.jobId && (
                    <span className="dim"> · tailored for job #{version.jobId}</span>
                  )}
                </span>
                <span>
                  +{adds} / −{dels}
                </span>
              </div>
              <div>
                {(diff.addedBullets ?? []).map((line, i) => (
                  <div className="diff-row add" key={`add-${i}`}>
                    <div className="ln"></div>
                    <div className="ln">{i + 1}</div>
                    <div className="content">{line}</div>
                  </div>
                ))}
                {(diff.removedBullets ?? []).map((line, i) => (
                  <div className="diff-row del" key={`del-${i}`}>
                    <div className="ln">{i + 1}</div>
                    <div className="ln"></div>
                    <div className="content">{line}</div>
                  </div>
                ))}
                {adds === 0 && dels === 0 && (
                  <div className="diff-row ctx">
                    <div className="ln" />
                    <div className="ln" />
                    <div className="content">
                      <span className="dim">No structured diff available.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {version.tailoredDocumentText && (
              <details style={{ marginTop: 14 }}>
                <summary
                  style={{ fontSize: 12.5, color: "var(--ink-3)", cursor: "pointer" }}
                >
                  Full rendered text
                </summary>
                <pre
                  style={{
                    background: "var(--paper-2)",
                    padding: 14,
                    borderRadius: 8,
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--ink-2)",
                    whiteSpace: "pre-wrap",
                    margin: "10px 0 0",
                    border: "1px solid var(--line-soft)",
                    maxHeight: 420,
                    overflow: "auto",
                  }}
                >
                  {version.tailoredDocumentText}
                </pre>
              </details>
            )}
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="approve-bar" style={{ flexDirection: "column", alignItems: "stretch", padding: 16, gap: 12 }}>
              <div>{stateChip}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  className="btn accent"
                  onClick={onApprove}
                  disabled={version.status !== "pending_approval" || approve.isPending}
                >
                  <Icon name="check" size={14} />
                  {approve.isPending ? "Approving…" : "Approve"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={onReject}
                  disabled={version.status !== "pending_approval" || reject.isPending}
                >
                  <Icon name="x" size={13} />
                  {reject.isPending ? "Rejecting…" : "Reject"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={onDelete}
                  disabled={remove.isPending}
                  style={{ color: "var(--danger)" }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="quiet-card flat">
              <div
                className="quiet-card-body"
                style={{ padding: 14, fontSize: 12.5, lineHeight: 1.55 }}
              >
                <span className="label">What happens on approve</span>
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 16,
                    color: "var(--ink-2)",
                  }}
                >
                  <li>State moves to <span className="mono">approved</span>.</li>
                  <li>DOCX + PDF export unlocked.</li>
                  <li>Attachable to an application.</li>
                  <li>Logged with runId for lineage.</li>
                </ul>
              </div>
            </div>

            {cites > 0 && (
              <div className="quiet-card flat">
                <div
                  className="quiet-card-body"
                  style={{
                    padding: 14,
                    fontSize: 12,
                    color: "var(--ink-3)",
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ color: "var(--accent)", flexShrink: 0 }}>
                    <Icon name="shield" size={12} />
                  </span>
                  <span>
                    {cites} claim{cites === 1 ? "" : "s"} cited from your verified ledger.
                  </span>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
