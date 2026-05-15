import { useListCoverLetterVersions, useApproveCoverLetterVersion, useRejectCoverLetterVersion, useUpdateCoverLetterVersion, useDeleteCoverLetterVersion, deleteCoverLetterVersion, useListClaims, getGetCoverLetterVersionQueryKey, getListCoverLetterVersionsQueryKey, type CoverLetterVersion } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { MessageSquare, Check, X, Tag, RotateCcw, ExternalLink, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api-errors";

type AnnotatedParagraph = {
  text: string;
  claimIds: number[];
  role: "opening" | "hook" | "body" | "closing";
  supportStatus?: "supported" | "partial" | "unsupported";
  truthReview?: {
    supportStatus: "supported" | "partial" | "unsupported";
    sourceClaimIds?: number[];
    unsupportedPhrases?: string[];
    metricViolations?: string[];
    disallowedImplicationViolations?: string[];
    gapNotes?: string[];
    jobKeywordsUsed?: string[];
    companySourcesUsed?: string[];
  };
};

function SupportBadge({ status }: { status?: AnnotatedParagraph["supportStatus"] }) {
  if (status === "supported") return <Badge variant="outline">Supported</Badge>;
  if (status === "partial") return <Badge variant="outline">Needs Review</Badge>;
  if (status === "unsupported") return <Badge variant="destructive">Unsupported</Badge>;
  return null;
}

const ROLE_COLORS: Record<string, string> = {
  opening: "bg-primary/10 border-primary/30",
  hook: "bg-primary/5 border-primary/20",
  body: "bg-warning/10 border-warning/30",
  closing: "bg-success/10 border-success/30",
};

const ROLE_LABEL_COLORS: Record<string, string> = {
  opening: "text-primary bg-primary/10",
  hook: "text-primary bg-primary/10",
  body: "text-warning bg-warning/10",
  closing: "text-success bg-success/10",
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

  const claimMap = new Map((claims ?? []).map(c => [c.id, c]));

  const handleApprove = (id: number) => {
    approve.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Cover letter approved" });
          queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
        },
        onError: (error) =>
          toast({
            title: "Failed to approve cover letter",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          })
      }
    );
  };

  const handleReject = (id: number, note?: string) => {
    const doReject = () => {
      reject.mutate(
        { id, data: {} },
        {
          onSuccess: () => {
            toast({ title: note ? `Rejected with note: "${note.slice(0, 40)}"` : "Cover letter rejected" });
            queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
            setRevisionTarget(null);
            setRevisionNote("");
          },
          onError: (error) =>
            toast({
              title: "Failed to reject cover letter",
              description: getErrorMessage(error, "Please try again."),
              variant: "destructive",
            })
        }
      );
    };
    if (note) {
      updateCL.mutate(
        { id, data: { notes: `Revision request: ${note}` } },
        { onSuccess: doReject, onError: doReject }
      );
    } else {
      doReject();
    }
  };

  const handleDelete = (id: number) => {
    deleteCL.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Cover letter deleted" });
          queryClient.removeQueries({ queryKey: getGetCoverLetterVersionQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
          setDeleteTarget(null);
        },
        onError: (error) =>
          toast({
            title: "Failed to delete cover letter",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          })
      }
    );
  };

  const handleBulkDelete = async () => {
    const toDelete = versions ?? [];
    if (toDelete.length === 0) {
      setShowBulkDelete(false);
      return;
    }
    try {
      await Promise.all(toDelete.map(v => deleteCoverLetterVersion(v.id)));
      toast({ title: `Deleted ${toDelete.length} cover letter${toDelete.length !== 1 ? 's' : ''}` });
      toDelete.forEach((version) => {
        queryClient.removeQueries({ queryKey: getGetCoverLetterVersionQueryKey(version.id) });
      });
      queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
    } catch (error) {
      toast({
        title: "Failed to delete some cover letters",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setShowBulkDelete(false);
    }
  };

  const parseAnnotations = (version: CoverLetterVersion): AnnotatedParagraph[] | null => {
    if (!Array.isArray(version.annotatedParagraphs)) return null;
    return version.annotatedParagraphs as AnnotatedParagraph[];
  };

  return (
    <div>
      <PageHeader
        title="Cover Letter Queue"
        subtitle="Review AI-drafted cover letters with claim attribution before approving."
        variant="workflow"
      >
        <Button variant="outline" size="sm" onClick={() => setShowBulkDelete(true)}>
          <Trash2 /> Clean Up
        </Button>
      </PageHeader>

      <div>
        {isLoading ? (
          <>
            <Skeleton />
            <Skeleton />
          </>
        ) : versions?.length === 0 ? (
          <ContentCard>
            <div>
              <div>
                <MessageSquare />
              </div>
              <h3>Queue empty</h3>
              <p>
                No cover letters pending review right now.
              </p>
            </div>
          </ContentCard>
        ) : (
          versions?.map((version) => {
            const annotations = parseAnnotations(version);
            const seriousTruthIssues = annotations?.filter((para) => para.supportStatus === "unsupported").length ?? 0;
            return (
              <ContentCard key={version.id} data-testid={`card-cl-${version.id}`}>
                <div>
                  <div>
                    <div>
                      <h3>Cover Letter #{version.id}</h3>
                      <Badge variant={
                        version.status === "pending_approval" ? "secondary" :
                        version.status === "approved" ? "default" : "destructive"
                      }>
                        {version.status.replace("_", " ")}
                      </Badge>
                      {seriousTruthIssues > 0 && (
                        <Badge variant="destructive">{seriousTruthIssues} truth issue{seriousTruthIssues === 1 ? "" : "s"}</Badge>
                      )}
                    </div>
                    <p>
                      {version.jobId && (
                        <>For <Link to={`/jobs/${version.jobId}`}>Job #{version.jobId}</Link>{" "}&mdash;{" "}</>
                      )}
                      {annotations ? `${annotations.length} annotated paragraph${annotations.length !== 1 ? "s" : ""}` : "Full draft view"}
                    </p>
                  </div>

                  <div>
                    {version.status === "pending_approval" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setRevisionTarget(version); setRevisionNote(""); }}
                          data-testid={`btn-revision-cl-${version.id}`}
                        >
                          <RotateCcw /> Request Revision
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReject(version.id)}
                          disabled={reject.isPending}
                          data-testid={`btn-reject-cl-${version.id}`}
                        >
                          <X /> Reject
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(version.id)}
                          disabled={approve.isPending}
                          data-testid={`btn-approve-cl-${version.id}`}
                        >
                          <Check /> Approve
                        </Button>
                      </>
                    )}
                    {version.status === "approved" && (
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/api/cover-letter-versions/${version.id}/export`} target="_blank" rel="noopener noreferrer">
                          Export DOCX <ExternalLink />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(version)}
                      disabled={deleteCL.isPending}
                      data-testid={`btn-delete-cl-${version.id}`}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </div>
                </div>

                <div />

                <div>
                  {annotations ? (
                    <div>
                      {annotations.map((para, i) => (
                        <div
                          key={i}
                          data-testid={`cl-para-${version.id}-${i}`}
                        >
                          <div>
                            <span>
                              {para.role}
                            </span>
                            <SupportBadge status={para.supportStatus ?? para.truthReview?.supportStatus} />
                            {para.claimIds.length > 0 && (
                              <div>
                                <Tag />
                                {para.claimIds.map((cid) => {
                                  const claim = claimMap.get(cid);
                                  return (
                                    <span
                                      key={cid}
                                      title={claim?.summary}
                                    >
                                      {claim ? claim.summary.slice(0, 30) + (claim.summary.length > 30 ? "…" : "") : `Claim #${cid}`}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <p>{para.text}</p>
                          {para.truthReview && (
                            <div>
                              <div>
                                <ShieldCheck />
                                <span>Truth review</span>
                              </div>
                              {(para.truthReview.unsupportedPhrases?.length ?? 0) > 0 && (
                                <p>
                                  <AlertCircle />
                                  <span>{para.truthReview.unsupportedPhrases?.join("; ")}</span>
                                </p>
                              )}
                              {(para.truthReview.gapNotes?.length ?? 0) > 0 && (
                                <p>Gaps: {para.truthReview.gapNotes?.join("; ")}</p>
                              )}
                              {(para.truthReview.jobKeywordsUsed?.length ?? 0) > 0 && (
                                <p>JD keywords: {para.truthReview.jobKeywordsUsed?.join(", ")}</p>
                              )}
                              {(para.truthReview.companySourcesUsed?.length ?? 0) > 0 && (
                                <p>Company/job sources: {para.truthReview.companySourcesUsed?.join(", ")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {version.draftContent || "No content generated yet."}
                    </div>
                  )}
                </div>
              </ContentCard>
            );
          })
        )}
      </div>

      <Dialog open={!!revisionTarget} onOpenChange={(o) => { if (!o) { setRevisionTarget(null); setRevisionNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision — Cover Letter #{revisionTarget?.id}</DialogTitle>
          </DialogHeader>
          <div>
            <p>
              Describe what should be changed. This will reject the draft and log your feedback for the next generation.
            </p>
            <Textarea
              placeholder="e.g. The second paragraph oversells my ML experience. Tone down and focus on the team leadership claim instead."
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              data-testid="input-revision-note"
            />
            <div>
              <Button variant="outline" onClick={() => { setRevisionTarget(null); setRevisionNote(""); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={reject.isPending || updateCL.isPending}
                onClick={() => revisionTarget && handleReject(revisionTarget.id, revisionNote)}
                data-testid="btn-confirm-revision"
              >
                Reject &amp; Log Revision
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cover Letter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this cover letter? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteCL.isPending}
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              data-testid="btn-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clean Up Cover Letters</DialogTitle>
            <DialogDescription>
              This will permanently delete every cover letter in the queue, including approved test drafts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              data-testid="btn-confirm-bulk-delete"
            >
              Delete All Cover Letters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
