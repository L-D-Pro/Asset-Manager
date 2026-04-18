import {
  useListResumeVersions,
  useApproveResumeVersion,
  useRejectResumeVersion,
  useUpdateResumeVersion,
  getListResumeVersionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Check, X, ExternalLink, Plus, Minus, ArrowLeftRight, ThumbsUp, ThumbsDown, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { getErrorMessage } from "@/lib/api-errors";

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

function DocumentPreview({
  content,
  baseResumeVersionId,
}: {
  content: string | null | undefined;
  baseResumeVersionId: number | null | undefined;
}) {
  if (!content) {
    return (
      <Alert variant="default" className="border-dashed">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No full tailored draft was stored for this version.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tailored Draft
        </p>
        {baseResumeVersionId != null && (
          <Badge variant="outline" className="text-xs">
            Base Resume #{baseResumeVersionId}
          </Badge>
        )}
      </div>
      <div className="rounded-md border bg-muted/20 p-4">
        <pre className="whitespace-pre-wrap break-words text-sm leading-6 font-sans">
          {content}
        </pre>
      </div>
    </div>
  );
}

type ChangeDecision = "accept" | "reject" | "pending";
type VersionDecisions = Record<string, ChangeDecision>;

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

function decisionsToNote(decisions: VersionDecisions, diffData: DiffData): string {
  const accepted: string[] = [];
  const rejected: string[] = [];
  Object.entries(decisions).forEach(([key, d]) => {
    const parts = key.split("-");
    const type = parts[1];
    const idx = parseInt(parts[2], 10);
    let text = "";
    if (type === "add") text = diffData.addedBullets?.[idx] ?? key;
    else if (type === "rem") text = diffData.removedBullets?.[idx] ?? key;
    else if (type === "reord") text = diffData.reorderedSections?.[idx] ?? key;
    if (d === "accept") accepted.push(`+ ${text}`);
    else if (d === "reject") rejected.push(`- ${text}`);
  });
  const lines: string[] = ["Resume version change review:"];
  if (accepted.length) { lines.push("ACCEPTED:"); accepted.forEach(l => lines.push(l)); }
  if (rejected.length) { lines.push("REJECTED:"); rejected.forEach(l => lines.push(l)); }
  return lines.join("\n");
}

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
    type === "added" ? "bg-green-50 border-green-200 text-green-800" :
    type === "removed" ? "bg-red-50 border-red-200 text-red-800" :
    "bg-blue-50 border-blue-200 text-blue-800";
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
  const total = Object.keys(decisions).length;
  const accepted = Object.values(decisions).filter(d => d === "accept").length;
  const rejected = Object.values(decisions).filter(d => d === "reject").length;
  const pending = total - accepted - rejected;

  return (
    <div className="space-y-3">
      {diffData.summary && (
        <div className="p-3 rounded-md bg-muted/50 border text-sm">
          <p className="font-medium text-xs text-muted-foreground mb-1">AI Summary</p>
          <p>{diffData.summary}</p>
        </div>
      )}
      {total > 0 && (
        <div className="text-xs flex gap-3" data-testid={`decisions-summary-${versionId}`}>
          <span className="text-green-600 font-medium">{accepted} accepted</span>
          <span className="text-red-600 font-medium">{rejected} rejected</span>
          {pending > 0 && <span className="text-orange-600 font-medium">{pending} pending decision</span>}
        </div>
      )}
      {diffData.addedBullets && diffData.addedBullets.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border-b text-xs font-semibold text-green-700">
            <Plus className="h-3 w-3" /> Added Bullets ({diffData.addedBullets.length})
          </div>
          <ul>
            {diffData.addedBullets.map((b, i) => (
              <ChangeItem key={`${versionId}-add-${i}`} text={b} type="added" changeKey={`${versionId}-add-${i}`}
                decision={decisions[`${versionId}-add-${i}`] ?? "pending"} onDecide={onDecide} />
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
              <ChangeItem key={`${versionId}-rem-${i}`} text={b} type="removed" changeKey={`${versionId}-rem-${i}`}
                decision={decisions[`${versionId}-rem-${i}`] ?? "pending"} onDecide={onDecide} />
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
              <ChangeItem key={`${versionId}-reord-${i}`} text={s} type="reordered" changeKey={`${versionId}-reord-${i}`}
                decision={decisions[`${versionId}-reord-${i}`] ?? "pending"} onDecide={onDecide} />
            ))}
          </ul>
        </div>
      )}
      {diffData.bulletsTotal !== undefined && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{diffData.bulletsTotal} bullets total</span>
          {diffData.bulletsPassedValidation !== undefined && <span>{diffData.bulletsPassedValidation} passed truth-lock</span>}
          {diffData.bulletsDiscarded !== undefined && diffData.bulletsDiscarded > 0 && <span className="text-destructive">{diffData.bulletsDiscarded} discarded</span>}
          {diffData.modelName && <span>via {diffData.modelName}</span>}
        </div>
      )}
    </div>
  );
}

export default function ResumeVersionsPage() {
  const { data: versions, isLoading } = useListResumeVersions();
  const approve = useApproveResumeVersion();
  const reject = useRejectResumeVersion();
  const updateResume = useUpdateResumeVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [decisions, setDecisions] = useState<Record<number, VersionDecisions>>({});

  const getDecisions = (versionId: number, diffData: DiffData): VersionDecisions => {
    if (!decisions[versionId]) return buildInitialDecisions(versionId, diffData);
    return decisions[versionId];
  };

  const handleDecide = (versionId: number) => (changeKey: string, decision: ChangeDecision) => {
    setDecisions(prev => ({
      ...prev,
      [versionId]: { ...(prev[versionId] ?? {}), [changeKey]: decision },
    }));
  };

  const handleAcceptAll = (versionId: number, diffData: DiffData) => {
    const all = buildInitialDecisions(versionId, diffData);
    const accepted: VersionDecisions = {};
    Object.keys(all).forEach(k => { accepted[k] = "accept"; });
    setDecisions(prev => ({ ...prev, [versionId]: accepted }));
  };

  const handleApprove = (id: number, diffData: DiffData | null | undefined, versionDecisions: VersionDecisions) => {
    const total = Object.keys(versionDecisions).length;
    const pending = Object.values(versionDecisions).filter(d => d === "pending").length;
    if (total > 0 && pending > 0) {
      toast({ title: `Please decide all ${pending} pending change(s) before approving`, variant: "destructive" });
      return;
    }
    const doApprove = () => {
      approve.mutate({ id, data: {} }, {
        onSuccess: () => {
          toast({ title: total > 0 ? "Resume version approved with change decisions recorded" : "Resume version approved" });
          queryClient.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
        },
        onError: (error) =>
          toast({
            title: "Failed to approve resume version",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          })
      });
    };
    if (total > 0 && diffData) {
      const note = decisionsToNote(versionDecisions, diffData);
      updateResume.mutate(
        { id, data: { notes: note } },
        { onSuccess: doApprove, onError: doApprove }
      );
    } else {
      doApprove();
    }
  };

  const handleReject = (id: number) => {
    reject.mutate({ id, data: {} }, {
      onSuccess: () => {
        toast({ title: "Resume version rejected" });
        queryClient.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
      },
      onError: (error) =>
        toast({
          title: "Failed to reject resume version",
          description: getErrorMessage(error, "Please try again."),
          variant: "destructive",
        })
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resume Queue</h1>
        <p className="text-muted-foreground mt-1">Review each individual change before approving. Accepted/rejected bullet decisions are recorded on the version before approval.</p>
      </div>
      <div className="grid gap-4">
        {isLoading ? (
          <><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></>
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
            const hasDocument = Boolean(version.tailoredDocumentText);
            const shouldShowReview = hasDiff || hasDocument;
            const versionDecisions = hasDiff ? getDecisions(version.id, diffData) : {};
            const totalDecisions = Object.keys(versionDecisions).length;
            const pendingCount = Object.values(versionDecisions).filter(d => d === "pending").length;
            const hasPending = pendingCount > 0;

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
                        {version.status === "pending_approval" && hasDiff && hasPending && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                            {pendingCount} undecided
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {version.jobId && (
                          <>For <Link to={`/jobs/${version.jobId}`} className="text-primary hover:underline">Job #{version.jobId}</Link> — </>
                        )}
                        Created {new Date(version.createdAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {version.status === "pending_approval" && hasDiff && totalDecisions > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleAcceptAll(version.id, diffData)}
                          data-testid={`btn-accept-all-${version.id}`}
                        >
                          Accept All
                        </Button>
                      )}
                      {version.status === "pending_approval" && (
                        <>
                          <Button
                            variant="outline" size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleReject(version.id)}
                            disabled={reject.isPending}
                            data-testid={`btn-reject-resume-${version.id}`}
                          >
                            <X className="mr-1 h-4 w-4" /> Reject
                          </Button>
                          <Button
                            variant="default" size="sm"
                            onClick={() => handleApprove(version.id, diffData, versionDecisions)}
                            disabled={approve.isPending || updateResume.isPending}
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
                {shouldShowReview && (
                  <>
                    <Separator />
                    <CardContent className="pt-4 space-y-3">
                      <DocumentPreview
                        content={version.tailoredDocumentText}
                        baseResumeVersionId={version.baseResumeVersionId}
                      />
                      {version.status === "pending_approval" && hasDiff && hasPending && (
                        <Alert variant="default" className="border-orange-200 bg-orange-50">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-800 text-xs">
                            {pendingCount} change{pendingCount > 1 ? "s" : ""} still need{pendingCount === 1 ? "s" : ""} a decision. Accept or reject each before approving — your decisions will be saved on the version record.
                          </AlertDescription>
                        </Alert>
                      )}
                      {hasDiff && (
                        <>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Per-Change Review
                          </p>
                          <DiffReview
                            diffData={diffData}
                            versionId={version.id}
                            decisions={versionDecisions}
                            onDecide={handleDecide(version.id)}
                          />
                        </>
                      )}
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
