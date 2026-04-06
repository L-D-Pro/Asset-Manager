import { useListResumeVersions, useApproveResumeVersion, useRejectResumeVersion, getListResumeVersionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Check, X, ExternalLink, Plus, Minus, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

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

function DiffView({ diffData }: { diffData: unknown }) {
  if (!diffData) return null;
  let d: DiffData;
  try {
    d = diffData as DiffData;
  } catch {
    return (
      <div className="mt-4 p-4 bg-muted/50 rounded-md border text-sm">
        <pre className="text-xs overflow-auto max-h-32">{JSON.stringify(diffData, null, 2)}</pre>
      </div>
    );
  }

  const hasContent = d.addedBullets?.length || d.removedBullets?.length || d.reorderedSections?.length || d.summary;
  if (!hasContent) return null;

  return (
    <div className="mt-4 space-y-3">
      {d.summary && (
        <div className="p-3 rounded-md bg-muted/50 border text-sm">
          <p className="font-medium text-xs text-muted-foreground mb-1">AI Summary</p>
          <p>{d.summary}</p>
        </div>
      )}

      {(d.addedBullets && d.addedBullets.length > 0) && (
        <div className="rounded-md border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border-b text-xs font-semibold text-green-700">
            <Plus className="h-3 w-3" /> Added Bullets ({d.addedBullets.length})
          </div>
          <ul className="divide-y">
            {d.addedBullets.map((b, i) => (
              <li key={i} className="px-3 py-2 text-sm text-green-800 bg-green-50/50 flex items-start gap-2">
                <span className="text-green-500 mt-0.5 shrink-0">+</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(d.removedBullets && d.removedBullets.length > 0) && (
        <div className="rounded-md border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border-b text-xs font-semibold text-red-700">
            <Minus className="h-3 w-3" /> Removed Bullets ({d.removedBullets.length})
          </div>
          <ul className="divide-y">
            {d.removedBullets.map((b, i) => (
              <li key={i} className="px-3 py-2 text-sm text-red-800 bg-red-50/50 flex items-start gap-2 line-through">
                <span className="text-red-500 mt-0.5 shrink-0 no-underline">−</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(d.reorderedSections && d.reorderedSections.length > 0) && (
        <div className="rounded-md border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border-b text-xs font-semibold text-blue-700">
            <ArrowLeftRight className="h-3 w-3" /> Reordered Sections
          </div>
          <ul className="divide-y">
            {d.reorderedSections.map((s, i) => (
              <li key={i} className="px-3 py-2 text-sm text-blue-800 bg-blue-50/50">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {(d.bulletsTotal !== undefined) && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{d.bulletsTotal} bullets total</span>
          {d.bulletsPassedValidation !== undefined && <span>{d.bulletsPassedValidation} passed truth-lock</span>}
          {d.bulletsDiscarded !== undefined && d.bulletsDiscarded > 0 && <span className="text-destructive">{d.bulletsDiscarded} discarded</span>}
          {d.modelName && <span>via {d.modelName}</span>}
        </div>
      )}
    </div>
  );
}

export default function ResumeVersionsPage() {
  const { data: versions, isLoading } = useListResumeVersions();
  const approve = useApproveResumeVersion();
  const reject = useRejectResumeVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        <p className="text-muted-foreground mt-1">Review per-change diffs and approve AI-tailored resume versions.</p>
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
              No resume versions pending review right now. Trigger "Tailor Resume" from a job detail page to generate one.
            </p>
          </Card>
        ) : (
          versions?.map((version) => (
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

              {Boolean(version.diffData) && (
                <>
                  <Separator />
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Change Diff</p>
                    <DiffView diffData={version.diffData} />
                  </CardContent>
                </>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
