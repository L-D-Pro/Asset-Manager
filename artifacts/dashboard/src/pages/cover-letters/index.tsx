import {
  useListCoverLetterVersions,
  useApproveCoverLetterVersion,
  useRejectCoverLetterVersion,
  useUpdateCoverLetterVersion,
  useDeleteCoverLetterVersion,
  deleteCoverLetterVersion,
  useListClaims,
  getGetCoverLetterVersionQueryKey,
  getListCoverLetterVersionsQueryKey,
  type CoverLetterVersion,
} from "@workspace/api-client-react";
import { MessageSquare, Check, X, Tag, RotateCcw, ExternalLink, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { getErrorMessage } from "@/lib/api-errors";
import { Portal } from "@/components/ui/portal";

type AnnotatedParagraph = {
  text: string;
  claimIds: number[];
  role: "opening" | "hook" | "body" | "closing";
  supportStatus?: "supported" | "partial" | "unsupported";
  truthReview?: {
    supportStatus: "supported" | "partial" | "unsupported";
    unsupportedPhrases?: string[];
    gapNotes?: string[];
    jobKeywordsUsed?: string[];
    companySourcesUsed?: string[];
  };
};

function SupportChip({ status }: { status?: AnnotatedParagraph["supportStatus"] }) {
  if (status === "supported") return <span className="chip success dot" style={{ fontSize: 10, padding: "1px 7px" }}>supported</span>;
  if (status === "partial") return <span className="chip warn dot" style={{ fontSize: 10, padding: "1px 7px" }}>needs review</span>;
  if (status === "unsupported") return <span className="chip" style={{ fontSize: 10, padding: "1px 7px", background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-line)" }}>unsupported</span>;
  return null;
}

const ROLE_LABEL: Record<string, string> = {
  opening: "Opening",
  hook: "Hook",
  body: "Body",
  closing: "Closing",
};

export default function CoverLettersPage() {
  const { data: versions, isLoading } = useListCoverLetterVersions();
  const { data: claims } = useListClaims();
  const approve = useApproveCoverLetterVersion();
  const reject = useRejectCoverLetterVersion();
  const updateCL = useUpdateCoverLetterVersion();
  const deleteCL = useDeleteCoverLetterVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [revisionTarget, setRevisionTarget] = useState<CoverLetterVersion | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CoverLetterVersion | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const claimMap = new Map((claims ?? []).map((c) => [c.id, c]));

  const handleApprove = (id: number) => {
    approve.mutate({ id, data: {} }, {
      onSuccess: () => {
        toast({ title: "Cover letter approved" });
        queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to approve", description: getErrorMessage(err, "Please try again."), variant: "destructive" }),
    });
  };

  const handleReject = (id: number, note?: string) => {
    const doReject = () => {
      reject.mutate({ id, data: {} }, {
        onSuccess: () => {
          toast({ title: note ? `Rejected — revision logged` : "Cover letter rejected" });
          queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
          setRevisionTarget(null);
          setRevisionNote("");
        },
        onError: (err) => toast({ title: "Failed to reject", description: getErrorMessage(err, "Please try again."), variant: "destructive" }),
      });
    };
    if (note) {
      updateCL.mutate({ id, data: { notes: `Revision request: ${note}` } }, { onSuccess: doReject, onError: doReject });
    } else {
      doReject();
    }
  };

  const handleDelete = (id: number) => {
    deleteCL.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Cover letter deleted" });
        queryClient.removeQueries({ queryKey: getGetCoverLetterVersionQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
        setDeleteTarget(null);
      },
      onError: (err) => toast({ title: "Failed to delete", description: getErrorMessage(err, "Please try again."), variant: "destructive" }),
    });
  };

  const handleBulkDelete = async () => {
    const toDelete = versions ?? [];
    if (toDelete.length === 0) { setShowBulkDelete(false); return; }
    try {
      await Promise.all(toDelete.map((v) => deleteCoverLetterVersion(v.id)));
      toast({ title: `Deleted ${toDelete.length} cover letter${toDelete.length !== 1 ? "s" : ""}` });
      toDelete.forEach((v) => queryClient.removeQueries({ queryKey: getGetCoverLetterVersionQueryKey(v.id) }));
      queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
    } catch (err) {
      toast({ title: "Failed to delete some cover letters", description: getErrorMessage(err, "Please try again."), variant: "destructive" });
    } finally {
      setShowBulkDelete(false);
    }
  };

  const parseAnnotations = (v: CoverLetterVersion): AnnotatedParagraph[] | null =>
    Array.isArray(v.annotatedParagraphs) ? v.annotatedParagraphs as AnnotatedParagraph[] : null;

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">cover-letter queue · AI drafts pending human review</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Cover letters <em>· pending approval</em></h1>
        </div>
        <button className="btn ghost sm" type="button" onClick={() => setShowBulkDelete(true)}>
          <Trash2 size={13} strokeWidth={1.8} /> Clean up
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {isLoading && (
          <>
            {[1, 2].map((i) => <div key={i} className="card" style={{ height: 100, opacity: 0.4 }} />)}
          </>
        )}
        {!isLoading && (versions?.length === 0) && (
          <div className="card" style={{ padding: "48px 18px", textAlign: "center" }}>
            <MessageSquare size={32} style={{ color: "var(--ink-4)", margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 6 }}>Queue empty</div>
            <div className="dim" style={{ fontSize: 13 }}>No cover letters pending review.</div>
          </div>
        )}
        {versions?.map((version) => {
          const annotations = parseAnnotations(version);
          const truthIssues = annotations?.filter((p) => p.supportStatus === "unsupported").length ?? 0;
          const isPending = version.status === "pending_approval";
          const isApproved = version.status === "approved";
          return (
            <div key={version.id} className="card" data-testid={`card-cl-${version.id}`}>
              {/* Card header */}
              <div className="card-h">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 className="card-title" style={{ fontSize: 15 }}>Cover letter #{version.id}</h2>
                  <span className={`chip ${isPending ? "warn dot" : isApproved ? "success dot" : "ghost"}`} style={{ fontSize: 10.5 }}>
                    {version.status.replace("_", " ")}
                  </span>
                  {truthIssues > 0 && (
                    <span className="chip" style={{ fontSize: 10.5, background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-line)" }}>
                      {truthIssues} truth issue{truthIssues !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {isPending && (
                    <>
                      <button
                        className="btn ghost sm" type="button"
                        onClick={() => { setRevisionTarget(version); setRevisionNote(""); }}
                        data-testid={`btn-revision-cl-${version.id}`}>
                        <RotateCcw size={12} strokeWidth={1.8} /> Request revision
                      </button>
                      <button
                        className="btn ghost sm" type="button"
                        onClick={() => handleReject(version.id)}
                        disabled={reject.isPending}
                        data-testid={`btn-reject-cl-${version.id}`}>
                        <X size={12} strokeWidth={1.8} /> Reject
                      </button>
                      <button
                        className="btn primary sm" type="button"
                        onClick={() => handleApprove(version.id)}
                        disabled={approve.isPending}
                        data-testid={`btn-approve-cl-${version.id}`}>
                        <Check size={12} strokeWidth={1.8} /> Approve
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <a
                      className="btn sm"
                      href={`/api/cover-letter-versions/${version.id}/export`}
                      target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={12} strokeWidth={1.8} /> Export DOCX
                    </a>
                  )}
                  <button
                    className="btn ghost sm" type="button"
                    onClick={() => setDeleteTarget(version)}
                    disabled={deleteCL.isPending}
                    data-testid={`btn-delete-cl-${version.id}`}>
                    <Trash2 size={12} strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              {/* Meta line */}
              <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--line-soft)", fontSize: 12.5, color: "var(--ink-3)" }}>
                {version.jobId && (
                  <>For <Link to={`/jobs/${version.jobId}`} style={{ color: "var(--accent-ink)" }}>Job #{version.jobId}</Link> — </>
                )}
                {annotations ? `${annotations.length} annotated paragraph${annotations.length !== 1 ? "s" : ""}` : "Full draft view"}
              </div>

              {/* Content */}
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {annotations ? (
                  annotations.map((para, i) => (
                    <div key={i} data-testid={`cl-para-${version.id}-${i}`} style={{
                      padding: "12px 14px", borderRadius: 10,
                      background: "var(--paper-2)", border: "1px solid var(--line-soft)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span className="label" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {ROLE_LABEL[para.role] ?? para.role}
                        </span>
                        <SupportChip status={para.supportStatus ?? para.truthReview?.supportStatus} />
                        {para.claimIds.length > 0 && (
                          <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 4 }}>
                            <Tag size={11} style={{ color: "var(--ink-4)" }} />
                            {para.claimIds.map((cid) => {
                              const claim = claimMap.get(cid);
                              return (
                                <span key={cid} className="chip ghost" style={{ fontSize: 10, padding: "1px 6px" }} title={claim?.summary}>
                                  {claim ? claim.summary.slice(0, 28) + (claim.summary.length > 28 ? "…" : "") : `#${cid}`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink)", margin: 0, fontFamily: "var(--font-display)" }}>{para.text}</p>
                      {para.truthReview && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 500, color: "var(--ink-3)" }}>
                            <ShieldCheck size={11} /> Truth review
                          </div>
                          {(para.truthReview.unsupportedPhrases?.length ?? 0) > 0 && (
                            <div style={{ display: "flex", gap: 5, fontSize: 12, color: "var(--red)" }}>
                              <AlertCircle size={11} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span>{para.truthReview.unsupportedPhrases?.join("; ")}</span>
                            </div>
                          )}
                          {(para.truthReview.gapNotes?.length ?? 0) > 0 && (
                            <div className="dim" style={{ fontSize: 12 }}>Gaps: {para.truthReview.gapNotes?.join("; ")}</div>
                          )}
                          {(para.truthReview.jobKeywordsUsed?.length ?? 0) > 0 && (
                            <div className="dim" style={{ fontSize: 12 }}>JD keywords: {para.truthReview.jobKeywordsUsed?.join(", ")}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>
                    {version.draftContent || "No content generated yet."}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Revision modal */}
      {revisionTarget && (
        <Portal>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => { setRevisionTarget(null); setRevisionNote(""); }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 480, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
          }}>
            <div className="card-h">
              <h2 className="card-title">Request revision — #{revisionTarget.id}</h2>
              <button type="button" className="settings-x" onClick={() => { setRevisionTarget(null); setRevisionNote(""); }}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="dim" style={{ fontSize: 13, lineHeight: 1.55 }}>
                Describe what should be changed. This rejects the draft and logs feedback for the next generation.
              </div>
              <div className="field">
                <textarea
                  className="input"
                  rows={4}
                  placeholder="e.g. The second paragraph oversells my ML experience. Tone down and focus on the team leadership claim instead."
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  data-testid="input-revision-note"
                  style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}
                />
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => { setRevisionTarget(null); setRevisionNote(""); }}>Cancel</button>
              <button
                type="button" className="btn sm"
                style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
                disabled={reject.isPending || updateCL.isPending}
                onClick={() => revisionTarget && handleReject(revisionTarget.id, revisionNote)}
                data-testid="btn-confirm-revision">
                Reject &amp; log revision
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <Portal>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 400, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
          }}>
            <div className="card-h">
              <h2 className="card-title">Delete cover letter</h2>
              <button type="button" className="settings-x" onClick={() => setDeleteTarget(null)}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Permanently delete cover letter #{deleteTarget.id}? This cannot be undone.
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                type="button" className="btn sm"
                style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
                disabled={deleteCL.isPending}
                onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
                data-testid="btn-confirm-delete">
                Delete
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Bulk delete modal */}
      {showBulkDelete && (
        <Portal>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setShowBulkDelete(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 400, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
          }}>
            <div className="card-h">
              <h2 className="card-title">Clean up cover letters</h2>
              <button type="button" className="settings-x" onClick={() => setShowBulkDelete(false)}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Permanently delete every cover letter in the queue, including approved test drafts. This cannot be undone.
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setShowBulkDelete(false)}>Cancel</button>
              <button
                type="button" className="btn sm"
                style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
                onClick={handleBulkDelete}
                data-testid="btn-confirm-bulk-delete">
                Delete all cover letters
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
