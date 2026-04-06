import { useListCoverLetterVersions, useApproveCoverLetterVersion, useRejectCoverLetterVersion, getListCoverLetterVersionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CoverLettersPage() {
  const { data: versions, isLoading } = useListCoverLetterVersions();
  const approve = useApproveCoverLetterVersion();
  const reject = useRejectCoverLetterVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleApprove = (id: number) => {
    approve.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Cover letter approved" });
          queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
        },
      }
    );
  };

  const handleReject = (id: number) => {
    reject.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Cover letter rejected" });
          queryClient.invalidateQueries({ queryKey: getListCoverLetterVersionsQueryKey() });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cover Letter Queue</h1>
        <p className="text-muted-foreground mt-1">Review and approve AI-drafted cover letters.</p>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : versions?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Queue empty</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              No cover letters pending review right now.
            </p>
          </Card>
        ) : (
          versions?.map((version) => (
            <Card key={version.id} data-testid={`card-cl-${version.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">Cover Letter #{version.id}</h3>
                      <Badge variant={version.status === "pending_approval" ? "secondary" : version.status === "approved" ? "default" : "destructive"}>
                        {version.status.replace("_", " ")}
                      </Badge>
                    </div>
                    {version.jobId && (
                      <p className="text-sm text-muted-foreground">
                        For Job ID: <Link href={`/jobs/${version.jobId}`} className="text-primary hover:underline">{version.jobId}</Link>
                      </p>
                    )}
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
                          data-testid={`btn-reject-cl-${version.id}`}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          className="flex-1 md:flex-none"
                          onClick={() => handleApprove(version.id)}
                          disabled={approve.isPending}
                          data-testid={`btn-approve-cl-${version.id}`}
                        >
                          <Check className="mr-1 h-4 w-4" /> Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="bg-muted p-4 rounded-md border text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {version.draftContent || "No content generated yet."}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
