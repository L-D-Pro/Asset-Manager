import {
  useListResumeVersions,
  useApproveResumeVersion,
  useRejectResumeVersion,
  useUpdateResumeVersion,
  useDeleteResumeVersion,
  deleteResumeVersion,
  getGetResumeVersionQueryKey,
  getListResumeVersionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Check, X, ExternalLink, Plus, Minus, ArrowLeftRight, ThumbsUp, ThumbsDown, AlertCircle, Trash2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
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
 truthReview?: TruthReviewSummary;
};

type TruthReviewItem = {
 text: string;
 supportStatus: "supported" | "partial" | "unsupported";
 sourceClaimIds?: number[];
 unsupportedPhrases?: string[];
 metricViolations?: string[];
 disallowedImplicationViolations?: string[];
 gapNotes?: string[];
 jobKeywordsUsed?: string[];
};

type TruthReviewSummary = {
 supportStatus: "supported" | "partial" | "unsupported";
 supportedCount: number;
 partialCount: number;
 unsupportedCount: number;
 seriousViolationCount: number;
 sourcePolicy?: string;
 items?: TruthReviewItem[];
};

function SupportBadge({ status }: { status: TruthReviewItem["supportStatus"] }) {
 if (status === "supported") return <Badge variant="outline" className="border-success/50 text-success">Supported</Badge>;
 if (status === "partial") return <Badge variant="outline" className="border-warning/50 text-warning">Needs Review</Badge>;
 return <Badge variant="destructive">Unsupported</Badge>;
}

function TruthReviewPanel({ review }: { review: TruthReviewSummary }) {
 const riskyItems = (review.items ?? []).filter(
  (item) =>
   item.supportStatus !== "supported" ||
   (item.gapNotes?.length ?? 0) > 0 ||
   (item.jobKeywordsUsed?.length ?? 0) > 0,
 );
 return (
  <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
   <div className="flex flex-wrap items-center gap-2">
    <ShieldCheck className="h-4 w-4 text-primary" />
    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Truth Review</span>
    <SupportBadge status={review.supportStatus} />
    <span className="text-xs text-muted-foreground">
     {review.supportedCount} supported, {review.partialCount} needs review, {review.unsupportedCount} unsupported
    </span>
   </div>
   {review.seriousViolationCount > 0 && (
    <Alert variant="destructive">
     <AlertCircle className="h-4 w-4" />
     <AlertDescription className="text-xs">
      {review.seriousViolationCount} serious truth issue{review.seriousViolationCount === 1 ? "" : "s"} found. Review unsupported phrases before approving.
     </AlertDescription>
    </Alert>
   )}
   {review.sourcePolicy && <p className="text-xs text-muted-foreground">{review.sourcePolicy}</p>}
   {riskyItems.length > 0 && (
    <div className="space-y-2">
     {riskyItems.map((item, index) => (
      <div key={`${item.text}-${index}`} className="rounded border bg-background/70 p-2 text-xs space-y-1">
       <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground line-clamp-2">{item.text}</p>
        <SupportBadge status={item.supportStatus} />
       </div>
       {(item.sourceClaimIds?.length ?? 0) > 0 && (
        <p className="text-muted-foreground">Claims: {item.sourceClaimIds?.join(", ")}</p>
       )}
       {(item.unsupportedPhrases?.length ?? 0) > 0 && (
        <p className="text-destructive">Unsupported: {item.unsupportedPhrases?.join("; ")}</p>
       )}
       {(item.gapNotes?.length ?? 0) > 0 && (
        <p className="text-warning">Gaps: {item.gapNotes?.join("; ")}</p>
       )}
       {(item.jobKeywordsUsed?.length ?? 0) > 0 && (
        <p className="text-muted-foreground">JD keywords: {item.jobKeywordsUsed?.join(", ")}</p>
       )}
      </div>
     ))}
    </div>
   )}
  </div>
 );
}

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
  <div className="card-glass p-4">
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
 type === "added" ? "bg-success/10 border-success/30 text-success" :
 type === "removed" ? "bg-destructive/10 border-destructive/30 text-destructive" :
 "bg-primary/10 border-primary/30 text-primary";
 const prefix = type === "added" ? "+" : type === "removed" ? "−" : "↕";
 return (
 <li className={`flex items-start gap-2 px-3 py-2 border-b last:border-b-0 ${colorBase} ${decision === "reject" ? "opacity-50 line-through" : ""}`}>
 <span className="font-mono mt-0.5 shrink-0">{prefix}</span>
 <span className="flex-1 text-sm">{text}</span>
 <div className="flex items-center gap-1 shrink-0">
 <button
 type="button"
 className={`p-1 rounded transition-colors ${decision === "accept" ? "bg-success/30" : "hover:bg-success/20"}`}
 onClick={() => onDecide(changeKey, decision === "accept" ? "pending" : "accept")}
 title="Accept this change"
 data-testid={`btn-accept-change-${changeKey}`}
 >
 <ThumbsUp className="h-3.5 w-3.5 text-success" />
 </button>
 <button
 type="button"
 className={`p-1 rounded transition-colors ${decision === "reject" ? "bg-destructive/30" : "hover:bg-destructive/20"}`}
 onClick={() => onDecide(changeKey, decision === "reject" ? "pending" : "reject")}
 title="Reject this change"
 data-testid={`btn-reject-change-${changeKey}`}
 >
  <ThumbsDown className="h-3.5 w-3.5 text-destructive" />
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
  <div className="card-glass p-3 text-sm">
 <p className="font-medium text-xs text-muted-foreground mb-1">AI Summary</p>
 <p>{diffData.summary}</p>
 </div>
 )}
 {diffData.truthReview && <TruthReviewPanel review={diffData.truthReview} />}
 {total > 0 && (
 <div className="text-xs flex gap-3" data-testid={`decisions-summary-${versionId}`}>
 <span className="text-success font-medium">{accepted} accepted</span>
 <span className="text-destructive font-medium">{rejected} rejected</span>
 {pending > 0 && <span className="text-warning font-medium">{pending} pending decision</span>}
 </div>
 )}
 {diffData.addedBullets && diffData.addedBullets.length > 0 && (
 <div className="rounded-md border overflow-hidden">
 <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border-b text-xs font-semibold text-success">
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
 <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 border-b text-xs font-semibold text-destructive">
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
 <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b text-xs font-semibold text-primary">
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
  const deleteVersion = useDeleteResumeVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [decisions, setDecisions] = useState<Record<number, VersionDecisions>>({});
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const toggleVersion = (id: number) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const handleDelete = (id: number) => {
    deleteVersion.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Resume version deleted" });
        setDeleteTarget(null);
        queryClient.removeQueries({ queryKey: getGetResumeVersionQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
      },
      onError: (error) =>
        toast({
          title: "Failed to delete resume version",
          description: getErrorMessage(error, "Please try again."),
          variant: "destructive",
        })
    });
  };

  const handleBulkDelete = async () => {
    const toDelete = versions ?? [];
    if (toDelete.length === 0) {
      setShowBulkDelete(false);
      return;
    }
    try {
      await Promise.all(toDelete.map(v => deleteResumeVersion(v.id)));
      toast({ title: `Deleted ${toDelete.length} resume version${toDelete.length !== 1 ? 's' : ''}` });
      toDelete.forEach((version) => {
        queryClient.removeQueries({ queryKey: getGetResumeVersionQueryKey(version.id) });
      });
      queryClient.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
    } catch (error) {
      toast({
        title: "Failed to delete some resume versions",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setShowBulkDelete(false);
    }
  };

 return (
  <div className="space-y-6">
      <PageHeader
        title="Resume Queue"
        subtitle="Review each individual change before approving. Accepted/rejected bullet decisions are recorded on the version record before approval."
        variant="workflow"
      >
        <Button variant="outline" size="sm" onClick={() => setShowBulkDelete(true)}>
          <Trash2 className="mr-1 h-4 w-4" /> Clean Up
        </Button>
      </PageHeader>
 <div className="grid gap-4">
 {isLoading ? (
 <><Skeleton className="h-28 w-full rounded-lg" /><Skeleton className="h-28 w-full rounded-lg" /></>
 ) : versions?.length === 0 ? (
  <ContentCard className="shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)]">
  <div className="flex flex-col items-center justify-center p-12 text-center">
 <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-4 border border-border">
 <FileText className="h-8 w-8" />
 </div>
 <h3 className="text-base font-semibold text-foreground mb-1.5">Queue empty</h3>
 <p className="text-sm text-muted-foreground max-w-sm">
 No resume versions pending review. Trigger "Tailor Resume" from a job detail page to generate one.
 </p>
 </div>
 </ContentCard>
 ) : (
 versions?.map((version) => {
 const diffData = version.diffData as DiffData | null | undefined;
 const hasDiff = diffData && hasDiffContent(diffData);
  const hasDocument = Boolean(version.tailoredDocumentText || version.rawContent);
 const shouldShowReview = hasDiff || hasDocument;
 const versionDecisions = hasDiff ? getDecisions(version.id, diffData) : {};
 const totalDecisions = Object.keys(versionDecisions).length;
 const pendingCount = Object.values(versionDecisions).filter(d => d === "pending").length;
 const hasPending = pendingCount > 0;
 const needsRegeneration =
 !version.templateId ||
 !(diffData as any)?.templateValidation ||
 /could not be repaired|truth lock failure|quality check failed|truth review failed/i.test(version.notes ?? "");

 return (
<ContentCard key={version.id} data-testid={`card-resume-${version.id}`} className="p-0">
  <div className="p-5 pb-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div className="space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold text-card-foreground">Resume Version #{version.id}</h3>
 <Badge variant={
 version.status === "pending_approval" ? "secondary" :
 version.status === "approved" ? "default" : "destructive"
 }>
 {version.status.replace("_", " ")}
 </Badge>
 {version.status === "pending_approval" && hasDiff && hasPending && (
 <Badge variant="outline" className="text-warning border-warning/50 text-xs">
 {pendingCount} undecided
 </Badge>
 )}
 {version.templateId && (
 <Badge variant="outline" className="text-xs">
 {(diffData as any)?.templateLabel ?? version.templateId}
 </Badge>
 )}
 </div>
          <p className="text-sm text-muted-foreground">
          {version.jobId && (
          <>For <Link to={`/jobs/${version.jobId}`} className="text-primary hover:underline">Job #{version.jobId}</Link> — </>
          )}
          Created {new Date(version.createdAt).toLocaleString()}
          </p>
 </div>
          <div className="flex items-center gap-2">
                {hasDocument && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleVersion(version.id)}
                    data-testid={`btn-toggle-content-${version.id}`}
                  >
                    {expandedVersions.has(version.id) ? (
                      <><ChevronUp className="mr-1 h-4 w-4" /> Hide Content</>
                    ) : (
                      <><ChevronDown className="mr-1 h-4 w-4" /> View Content</>
                    )}
                  </Button>
                )}
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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteTarget(version.id)}
                  disabled={deleteVersion.isPending}
                  data-testid={`btn-delete-resume-${version.id}`}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
                {version.status === "pending_approval" && (
                  <>
                    <Button
                      variant="secondary"
                      className="text-destructive"
                      size="sm"
                      onClick={() => handleReject(version.id)}
                      disabled={reject.isPending}
                      data-testid={`btn-reject-resume-${version.id}`}
                    >
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(version.id, diffData, versionDecisions)}
                      disabled={approve.isPending || updateResume.isPending || needsRegeneration}
                      data-testid={`btn-approve-resume-${version.id}`}
                    >
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                  </>
                )}
                {version.status === "approved" && (
                  <Button variant="secondary" size="sm" asChild>
                    <a href={`/api/resume-versions/${version.id}/export`} target="_blank" rel="noopener noreferrer">
                      Export DOCX <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
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
  </div>
              {shouldShowReview && (
                <>
                  <Separator />
                  <div className="px-5 pt-4 pb-5 space-y-3">
                    {expandedVersions.has(version.id) && (
                      <DocumentPreview
                        content={version.tailoredDocumentText || version.rawContent}
                        baseResumeVersionId={version.baseResumeVersionId}
                      />
                    )}
 {version.status === "pending_approval" && hasDiff && hasPending && (
 <Alert variant="default" className="border-warning/40 bg-warning/10">
 <AlertCircle className="h-4 w-4 text-warning" />
 <AlertDescription className="text-warning text-xs">
 {pendingCount} change{pendingCount > 1 ? "s" : ""} still need{pendingCount === 1 ? "s" : ""} a decision. Accept or reject each before approving — your decisions will be saved on the version record.
 </AlertDescription>
 </Alert>
 )}
 {version.status === "pending_approval" && needsRegeneration && (
 <Alert variant="destructive">
 <AlertCircle className="h-4 w-4" />
 <AlertDescription className="text-xs">
 This draft is diagnostic only. Regenerate it so structured truth review and template validation can pass before approval.
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
  </div>
 </>
 )}
  </ContentCard>
  );
  })
  )}
  </div>
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resume Version</DialogTitle>
            <DialogDescription>
              Are you sure? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { if (deleteTarget != null) handleDelete(deleteTarget); }}
              disabled={deleteVersion.isPending}
            >
              {deleteVersion.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clean Up Resume Versions</DialogTitle>
            <DialogDescription>
              This will permanently delete every resume version in the queue, including approved test drafts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              data-testid="btn-confirm-bulk-delete"
            >
              Delete All Resume Versions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>
  );
}
