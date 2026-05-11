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
  if (status === "supported") return <Badge variant="outline" className="border-success/50 text-success">Supported</Badge>;
  if (status === "partial") return <Badge variant="outline" className="border-warning/50 text-warning">Needs Review</Badge>;
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
    <div className="space-y-8">
      <PageHeader
        title="Cover Letter Queue"
        subtitle="Review AI-drafted cover letters with claim attribution before approving."
        variant="workflow"
      >
        <Button variant="outline" size="sm" onClick={() => setShowBulkDelete(true)}>
          <Trash2 className="mr-1 h-4 w-4" /> Clean Up
        </Button>
      </PageHeader>

      <div className="grid gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-56 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
          </>
        ) : versions?.length === 0 ? (
          <ContentCard>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-4 border border-border">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">Queue empty</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-card-foreground">Cover Letter #{version.id}</h3>
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
                    <p className="text-sm text-muted-foreground">
                      {version.jobId && (
                        <>For <Link to={`/jobs/${version.jobId}`} className="text-primary hover:underline">Job #{version.jobId}</Link>{" "}&mdash;{" "}</>
                      )}
                      {annotations ? `${annotations.length} annotated paragraph${annotations.length !== 1 ? "s" : ""}` : "Full draft view"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {version.status === "pending_approval" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setRevisionTarget(version); setRevisionNote(""); }}
                          data-testid={`btn-revision-cl-${version.id}`}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" /> Request Revision
                        </Button>
                        <Button
                          variant="secondary"
                          className="text-destructive"
                          size="sm"
                          onClick={() => handleReject(version.id)}
                          disabled={reject.isPending}
                          data-testid={`btn-reject-cl-${version.id}`}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(version.id)}
                          disabled={approve.isPending}
                          data-testid={`btn-approve-cl-${version.id}`}
                        >
                          <Check className="mr-1 h-4 w-4" /> Approve
                        </Button>
                      </>
                    )}
                    {version.status === "approved" && (
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/api/cover-letter-versions/${version.id}/export`} target="_blank" rel="noopener noreferrer">
                          Export DOCX <ExternalLink className="ml-1 h-3 w-3" />
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
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border/50" />

                <div className="p-6 pt-4 space-y-4">
                  {annotations ? (
                    <div className="space-y-3">
                      {annotations.map((para, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-md border text-sm ${ROLE_COLORS[para.role] || "bg-muted/50"}`}
                          data-testid={`cl-para-${version.id}-${i}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-semibold uppercase rounded px-1.5 py-0.5 ${ROLE_LABEL_COLORS[para.role] || "text-muted-foreground bg-muted"}`}>
                              {para.role}
                            </span>
                            <SupportBadge status={para.supportStatus ?? para.truthReview?.supportStatus} />
                            {para.claimIds.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <Tag className="h-3 w-3 text-muted-foreground" />
                                {para.claimIds.map((cid) => {
                                  const claim = claimMap.get(cid);
                                  return (
                                    <span
                                      key={cid}
                                      className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5"
                                      title={claim?.summary}
                                    >
                                      {claim ? claim.summary.slice(0, 30) + (claim.summary.length > 30 ? "…" : "") : `Claim #${cid}`}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <p className="leading-relaxed">{para.text}</p>
                          {para.truthReview && (
                            <div className="mt-3 rounded border bg-background/70 p-2 text-xs space-y-1">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <ShieldCheck className="h-3 w-3" />
                                <span>Truth review</span>
                              </div>
                              {(para.truthReview.unsupportedPhrases?.length ?? 0) > 0 && (
                                <p className="text-destructive flex gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                                  <span>{para.truthReview.unsupportedPhrases?.join("; ")}</span>
                                </p>
                              )}
                              {(para.truthReview.gapNotes?.length ?? 0) > 0 && (
                                <p className="text-warning">Gaps: {para.truthReview.gapNotes?.join("; ")}</p>
                              )}
                              {(para.truthReview.jobKeywordsUsed?.length ?? 0) > 0 && (
                                <p className="text-muted-foreground">JD keywords: {para.truthReview.jobKeywordsUsed?.join(", ")}</p>
                              )}
                              {(para.truthReview.companySourcesUsed?.length ?? 0) > 0 && (
                                <p className="text-muted-foreground">Company/job sources: {para.truthReview.companySourcesUsed?.join(", ")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="card-glass p-4 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe what should be changed. This will reject the draft and log your feedback for the next generation.
            </p>
            <Textarea
              placeholder="e.g. The second paragraph oversells my ML experience. Tone down and focus on the team leadership claim instead."
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              className="h-28"
              data-testid="input-revision-note"
            />
            <div className="flex justify-end gap-2">
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
