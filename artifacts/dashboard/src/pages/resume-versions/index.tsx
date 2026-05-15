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
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, versions.filter((v) => t.match(v.status)).length]),
  );

  return (
    <div>
      <div>
        <div>
          <h1>
            Resume review <em>· truth-locked drafts</em>
          </h1>
          <div>
            Every AI-tailored resume needs your explicit nod. Approve to unlock export and
            application attachment.
          </div>
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

      {isLoading && (
        <div>
          <span>Loading…</span>
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div>
          <span>
            No resume versions in this state.{" "}
            <Link to="/jobs">
              Tailor one from a job
            </Link>
            .
          </span>
        </div>
      )}

      <div>
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
      <span>approved</span>
    ) : version.status === "rejected" ? (
      <span>rejected</span>
    ) : (
      <span>pending approval</span>
    );

  return (
    <div>
      <div onClick={onToggle}>
        <div>
          <div>
            {version.label ?? `Resume version #${version.id}`}
            {version.jobId && (
              <Link
                to={`/jobs/${version.jobId}`}
                onClick={(e) => e.stopPropagation()}
              >
                · job #{version.jobId}
              </Link>
            )}
          </div>
          <div>
            +{adds} / −{dels} · {cites} citation{cites === 1 ? "" : "s"} ·{" "}
            {new Date(version.createdAt).toLocaleString()}
          </div>
        </div>
        {stateChip}
        <span>
          {version.templateId ?? "—"}
        </span>
        <span>
          #{version.id}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>

      {expanded && (
        <div>
          <div>
            {diff.summary && (
              <p>
                {diff.summary}
              </p>
            )}
            <div>
              <div>
                <span>
                  <span>
                    {version.label ?? `resume-v${version.id}.md`}
                  </span>
                  {version.jobId && (
                    <span> · tailored for job #{version.jobId}</span>
                  )}
                </span>
                <span>
                  +{adds} / −{dels}
                </span>
              </div>
              <div>
                {(diff.addedBullets ?? []).map((line, i) => (
                  <div key={`add-${i}`}>
                    <div></div>
                    <div>{i + 1}</div>
                    <div>{line}</div>
                  </div>
                ))}
                {(diff.removedBullets ?? []).map((line, i) => (
                  <div key={`del-${i}`}>
                    <div>{i + 1}</div>
                    <div></div>
                    <div>{line}</div>
                  </div>
                ))}
                {adds === 0 && dels === 0 && (
                  <div>
                    <div />
                    <div />
                    <div>
                      <span>No structured diff available.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {version.tailoredDocumentText && (
              <details>
                <summary>
                  Full rendered text
                </summary>
                <pre>
                  {version.tailoredDocumentText}
                </pre>
              </details>
            )}
          </div>

          <aside>
            <div>
              <div>{stateChip}</div>
              <div>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={version.status !== "pending_approval" || approve.isPending}
                >
                  <Check size={14} />
                  {approve.isPending ? "Approving…" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={version.status !== "pending_approval" || reject.isPending}
                >
                  <X size={13} />
                  {reject.isPending ? "Rejecting…" : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={remove.isPending}
                >
                  Delete
                </button>
              </div>
            </div>

            <div>
              <div>
                <span>What happens on approve</span>
                <ul>
                  <li>State moves to approved.</li>
                  <li>DOCX + PDF export unlocked.</li>
                  <li>Attachable to an application.</li>
                  <li>Logged with runId for lineage.</li>
                </ul>
              </div>
            </div>

            {cites > 0 && (
              <div>
                <div>
                  <span>
                    <Shield size={12} />
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
