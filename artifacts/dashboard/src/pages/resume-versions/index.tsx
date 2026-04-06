import { useListResumeVersions, useApproveResumeVersion, useRejectResumeVersion, getListResumeVersionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Check, X, ExternalLink, Plus, Minus, ArrowLeftRight, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

type DiffData = {
  addedBullets?: string[];
  removedBullets?: string[];
  reorderedSections?: string[];
  summary?: string;
  generatedAt?: string;
  modelName?: string;
  bulletsTotal?: number;
  bulletsPassedValidation?: number;
  bulletsDiscarded?: number;
};

type ChangeDecision = "accept" | "reject" | "pending";

type VersionDecisions = Record<string, ChangeDecision>;

function ChangeItem({
  text,
  type,
  changeKey,
  decision,
  onDecide,
}: {
  text: string;
  type: "added" | "removed" | "reordered";
  changeKey: string;
  decision: ChangeDecision;
  onDecide: (key: string, d: ChangeDecision) => void;
}) {
  const colorBase =
    type === "added"
      ? "bg-green-50 border-green-200 text-green-800"
      : type === "removed"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-blue-50 border-blue-200 text-blue-800";

  const prefix = type === "added" ? "+" : type === "removed" ? "−" : "↕";

  return (
    <li className={`flex items-start gap-2 px-3 py-2 border-b last:border-b-0 ${colorBase} ${decision === "reject" ? "opacity-50 line-through" : ""}`}>
      <span className="font-mono mt-0.5 shrink-0">{prefix}</span>
      <span className="flex-1 text-sm">{text}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className={`p-1 rounded transition-colors ${decision === "accept" ? "bg-green-200" : "hover:bg-green-100"}`}
          onClick={() => onDecide(changeKey, decision === "accept" ? "pending" : "accept")}
          title="Accept this change"
          data-testid={`btn-accept-change-${changeKey}`}
        >
          <ThumbsUp className="h-3.5 w-3.5 text-green-700" />
        </button>
        <button
          type="button"
          className={`p-1 rounded transition-colors ${decision === "reject" ? "bg-red-200" : "hover:bg-red-100"}`}
          onClick={() => onDecide(changeKey, decision === "reject" ? "pending" : "reject")}
          title="Reject this change"
          data-testid={`btn-reject-change-${changeKey}`}
        >
          <ThumbsDown className="h-3.5 w-3.5 text-red-700" />
        </button>
      </div>
    </li>
  );
}

function DiffReview({
  diffData,
  versionId,
  decisions,
  onDecide,
}: {
  diffData: DiffData;
  versionId: number;
  decisions: VersionDecisions;
  onDecide: (key: string, d: ChangeDecision) => void;
}) {
  const accepted = Object.values(decisions).filter(d => d === "accept").length;
  const rejected = Object.values(decisions).filter(d => d === "reject").length;
  const total = Object.keys(decisions).length;

  return (
    <div className="space-y-3">
      {diffData.summary && (
        <div className="p-3 rounded-md bg-muted/50 border text-sm">
          <p className="font-medium text-xs text-muted-foreground mb-1">AI Summary</p>
          <p>{diffData.summary}</p>
        </div>
      )}

      {total > 0 && (
        <div className="text-xs text-muted-foreground flex gap-3">
          <span className="text-green-600">{accepted} accepted</span>
          <span className="text-red-600">{rejected} rejected</span>
          <span>{total - accepted - rejected} pending</span>
        </div>
      )}

      {diffData.addedBullets && diffData.addedBullets.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border-b text-xs font-semibold text-green-700">
            <Plus className="h-3 w-3" /> Added Bullets ({diffData.addedBullets.length})
          </div>
          <ul>
            {diffData.addedBullets.map((b, i) => (
              <ChangeItem
                key={`${versionId}-add-${i}`}
                text={b}
                type="added"
                changeKey={`${versionId}-add-${i}`}
                decision={decisions[`${versionId}-add-${i}`] ?? "pending"}
                onDecide={onDecide}
              />
            ))}
          </ul>
        </div>
      )}

      {diffData.removedBullets && diffData.removedBullets.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border-b text-xs font-semibold text-red-700">
            <Minus className="h-3 w-3" /> Removed Bullets ({diffData.removedBullets.length})
          </div>
          <ul>
            {diffData.removedBullets.map((b, i) => (
              <ChangeItem
                key={`${versionId}-rem-${i}`}
                text={b}
                type="removed"
                changeKey={`${versionId}-rem-${i}`}
                decision={decisions[`${versionId}-rem-${i}`] ?? "pending"}
                onDecide={onDecide}
              />
            ))}
          </ul>
        </div>
      )}

      {diffData.reorderedSections && diffData.reorderedSections.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border-b text-xs font-semibold text-blue-700">
            <ArrowLeftRight className="h-3 w-3" /> Reordered Sections
          </div>
          <ul>
            {diffData.reorderedSections.map((s, i) => (
              <ChangeItem
                key={`${versionId}-reord-${i}`}
                text={s}
                type="reordered"
                changeKey={`${versionId}-reord-${i}`}
                decision={decisions[`${versionId}-reord-${i}`] ?? "pending"}
                onDecide={onDecide}
              />
            ))}
          </ul>
        </div>
      )}

      {diffData.bulletsTotal !== undefined && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{diffData.bulletsTotal} bullets total</span>
          {diffData.bulletsPassedValidation !== undefined && (
            <span>{diffData.bulletsPassedValidation} passed truth-lock</span>
          )}
          {diffData.bulletsDiscarded !== undefined && diffData.bulletsDiscarded > 0 && (
            <span className="text-destructive">{diffData.bulletsDiscarded} discarded</span>
          )}
          {diffData.modelName && <span>via {diffData.modelName}</span>}
        </div>
      )}
    </div>
  );
}

function hasDiffContent(d: DiffData): boolean {
  return !!(
    (d.addedBullets && d.addedBullets.length > 0) ||
    (d.removedBullets && d.removedBullets.length > 0) ||
    (d.reorderedSections && d.reorderedSections.length > 0) ||
    d.summary
  );
}

function buildInitialDecisions(versionId: number, d: DiffData): VersionDecisions {
  const out: VersionDecisions = {};
  (d.addedBullets ?? []).forEach((_, i) => { out[`${versionId}-add-${i}`] = "pending"; });
  (d.removedBullets ?? []).forEach((_, i) => { out[`${versionId}-rem-${i}`] = "pending"; });
  (d.reorderedSections ?? []).forEach((_, i) => { out[`${versionId}-reord-${i}`] = "pending"; });
  return out;
}

export default function ResumeVersionsPage() {
  const { data: versions, isLoading } = useListResumeVersions();
  const approve = useApproveResumeVersion();
  const reject = useRejectResumeVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [decisions, setDecisions] = useState<Record<number, VersionDecisions>>({});

  const getDecisions = (versionId: number, diffData: DiffData): VersionDecisions => {
    if (!decisions[versionId]) {
      return buildInitialDecisions(versionId, diffData);
    }
    return decisions[versionId];
  };

  const handleDecide = (versionId: number) => (changeKey: string, decision: ChangeDecision) => {
    setDecisions(prev => ({
      ...prev,
      [versionId]: { ...(prev[versionId] ?? {}), [changeKey]: decision },
    }));
  };

  const handleApprove = (id: number) => {
    approve.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Resume version approved" });
          queryClient.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
        },
        onError: () => toast({ title: "Failed to approve", variant: "destructive" })
      }
    );
  };

  const handleReject = (id: number) => {
    reject.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Resume version rejected" });
          queryClient.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
        },
        onError: () => toast({ title: "Failed to reject", variant: "destructive" })
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resume Queue</h1>
        <p className="text-muted-foreground mt-1">Review each individual change, then approve or reject the version.</p>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : versions?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Queue empty</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              No resume versions pending review. Trigger "Tailor Resume" from a job detail page to generate one.
            </p>
          </Card>
        ) : (
          versions?.map((version) => {
            const diffData = version.diffData as DiffData | null | undefined;
            const hasDiff = diffData && hasDiffContent(diffData);
            const versionDecisions = hasDiff
              ? getDecisions(version.id, diffData)
              : {};

            return (
              <Card key={version.id} data-testid={`card-resume-${version.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle>Resume Version #{version.id}</CardTitle>
                        <Badge variant={
                          version.status === "pending_approval" ? "secondary" :
                          version.status === "approved" ? "default" : "destructive"
                        }>
                          {version.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription>
                        {version.jobId && (
                          <>For <Link to={`/jobs/${version.jobId}`} className="text-primary hover:underline">Job #{version.jobId}</Link> — </>
                        )}
                        Created {new Date(version.createdAt).toLocaleString()}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {version.status === "pending_approval" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleReject(version.id)}
                            disabled={reject.isPending}
                            data-testid={`btn-reject-resume-${version.id}`}
                          >
                            <X className="mr-1 h-4 w-4" /> Reject
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(version.id)}
                            disabled={approve.isPending}
                            data-testid={`btn-approve-resume-${version.id}`}
                          >
                            <Check className="mr-1 h-4 w-4" /> Approve
                          </Button>
                        </>
                      )}
                      {version.fileUrl && (
                        <Button variant="secondary" size="sm" asChild>
                          <a href={version.fileUrl} target="_blank" rel="noopener noreferrer">
                            View <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {hasDiff && (
                  <>
                    <Separator />
                    <CardContent className="pt-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                        Per-Change Review — accept or reject individual changes before finalizing
                      </p>
                      <DiffReview
                        diffData={diffData}
                        versionId={version.id}
                        decisions={versionDecisions}
                        onDecide={handleDecide(version.id)}
                      />
                    </CardContent>
                  </>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
