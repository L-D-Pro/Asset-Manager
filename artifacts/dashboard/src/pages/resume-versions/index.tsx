import { useListResumeVersions, useApproveResumeVersion, useRejectResumeVersion, getListResumeVersionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, X, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

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
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resume Queue</h1>
        <p className="text-muted-foreground mt-1">Review and approve AI-tailored resume versions.</p>
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
              No resume versions pending review right now.
            </p>
          </Card>
        ) : (
          versions?.map((version) => (
            <Card key={version.id} data-testid={`card-resume-${version.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">Resume Version #{version.id}</h3>
                      <Badge variant={version.status === "pending_approval" ? "secondary" : version.status === "approved" ? "default" : "destructive"}>
                        {version.status.replace("_", " ")}
                      </Badge>
                    </div>
                    {version.jobId && (
                      <p className="text-sm text-muted-foreground">
                        For Job ID: <Link href={`/jobs/${version.jobId}`} className="text-primary hover:underline">{version.jobId}</Link>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground pt-2">Created at {new Date(version.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    {version.status === "pending_approval" && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 md:flex-none text-destructive hover:bg-destructive/10"
                          onClick={() => handleReject(version.id)}
                          disabled={reject.isPending}
                          data-testid={`btn-reject-resume-${version.id}`}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          className="flex-1 md:flex-none"
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
                {Boolean(version.diffData) && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-md text-sm border">
                    <p className="font-medium mb-2">Changes Summary:</p>
                    <pre className="text-xs overflow-auto max-h-32">
                      {JSON.stringify(version.diffData as Record<string, unknown>, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
