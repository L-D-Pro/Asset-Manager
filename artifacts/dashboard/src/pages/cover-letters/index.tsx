import { useListCoverLetterVersions, useApproveCoverLetterVersion, useRejectCoverLetterVersion, useUpdateCoverLetterVersion, useListClaims, getListCoverLetterVersionsQueryKey, type CoverLetterVersion } from "@workspace/api-client-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { MessageSquare, Check, X, Tag, RotateCcw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api-errors";

type AnnotatedParagraph = {
  text: string;
  claimIds: number[];
  role: "opening" | "hook" | "body" | "closing";
};

const ROLE_COLORS: Record<string, string> = {
  opening: "bg-blue-50 border-blue-200",
  hook: "bg-purple-50 border-purple-200",
  body: "bg-amber-50 border-amber-200",
  closing: "bg-green-50 border-green-200",
};

const ROLE_LABEL_COLORS: Record<string, string> = {
  opening: "text-blue-700 bg-blue-100",
  hook: "text-purple-700 bg-purple-100",
  body: "text-amber-700 bg-amber-100",
  closing: "text-green-700 bg-green-100",
};

export default function CoverLettersPage() {
  const { data: versions, isLoading } = useListCoverLetterVersions();
  const { data: claims } = useListClaims();
  const approve = useApproveCoverLetterVersion();
  const reject = useRejectCoverLetterVersion();
  const updateCL = useUpdateCoverLetterVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [revisionTarget, setRevisionTarget] = useState<CoverLetterVersion | null>(null);
  const [revisionNote, setRevisionNote] = useState("");

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

  const parseAnnotations = (version: CoverLetterVersion): AnnotatedParagraph[] | null => {
    if (!Array.isArray(version.annotatedParagraphs)) return null;
    return version.annotatedParagraphs as AnnotatedParagraph[];
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cover Letter Queue"
        subtitle="Review AI-drafted cover letters with claim attribution before approving."
        gradient="from-teal-500 via-teal-400 to-cyan-400"
      />

      <div className="grid gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </>
        ) : versions?.length === 0 ? (
          <ContentCard>
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 mb-5">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1.5">Queue empty</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                No cover letters pending review right now.
              </p>
            </div>
          </ContentCard>
        ) : (
          versions?.map((version) => {
            const annotations = parseAnnotations(version);
            return (
              <ContentCard key={version.id} data-testid={`card-cl-${version.id}`} className="p-0">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle>Cover Letter #{version.id}</CardTitle>
                        <Badge variant={
                          version.status === "pending_approval" ? "secondary" :
                          version.status === "approved" ? "default" : "destructive"
                        }>
                          {version.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription>
                        {version.jobId && (
                          <>For <Link to={`/jobs/${version.jobId}`} className="text-primary hover:underline">Job #{version.jobId}</Link>{" "}&mdash;{" "}</>
                        )}
                        {annotations ? `${annotations.length} annotated paragraph${annotations.length !== 1 ? "s" : ""}` : "Full draft view"}
                      </CardDescription>
                    </div>

                    {version.status === "pending_approval" && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => { setRevisionTarget(version); setRevisionNote(""); }}
                          data-testid={`btn-revision-cl-${version.id}`}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" /> Request Revision
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
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
                      </div>
                    )}
                    {version.status === "approved" && (
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" asChild>
                          <a href={`/api/cover-letter-versions/${version.id}/export`} target="_blank" rel="noopener noreferrer">
                            Export DOCX <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <Separator />

                <CardContent className="pt-4 space-y-4">
                  {annotations ? (
                    <div className="space-y-3">
                      {annotations.map((para, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-md border text-sm ${ROLE_COLORS[para.role] || "bg-muted/50"}`}
                          data-testid={`cl-para-${version.id}-${i}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${ROLE_LABEL_COLORS[para.role] || "text-muted-foreground bg-muted"}`}>
                              {para.role}
                            </span>
                            {para.claimIds.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <Tag className="h-3 w-3 text-muted-foreground" />
                                {para.claimIds.map((cid) => {
                                  const claim = claimMap.get(cid);
                                  return (
                                    <span
                                      key={cid}
                                      className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5"
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
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-muted p-4 rounded-md border text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {version.draftContent || "No content generated yet."}
                    </div>
                  )}
                </CardContent>
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
    </div>
  );
}
