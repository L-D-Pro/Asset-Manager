import { useGetJob, useParseJobDescription, useTailorJobResume, useDraftCoverLetter, getGetJobQueryKey, useScoreJob, getScoreJobQueryKey, useGetJobClaimMatches, getGetJobClaimMatchesQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, MapPin, ExternalLink, ArrowLeft, Wand2, AlertCircle, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id || "0", 10);
  const { data: job, isLoading } = useGetJob(jobId, { query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) } });
  const { data: score, isLoading: scoreLoading } = useScoreJob(jobId, undefined, { query: { enabled: !!jobId, queryKey: getScoreJobQueryKey(jobId) }});
  const { data: claimMatches, isLoading: matchesLoading } = useGetJobClaimMatches(jobId, { query: { enabled: !!jobId, queryKey: getGetJobClaimMatchesQueryKey(jobId) }});
  
  const parseJob = useParseJobDescription();
  const tailorResume = useTailorJobResume();
  const draftCoverLetter = useDraftCoverLetter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  const handleParse = () => {
    parseJob.mutate(
      { id: jobId, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Parsing started" });
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        },
        onError: () => toast({ title: "Failed to parse", variant: "destructive" })
      }
    );
  };

  const handleTailor = () => {
    tailorResume.mutate(
      { id: jobId, data: {} },
      {
        onSuccess: () => toast({ title: "Resume tailoring started" }),
        onError: () => toast({ title: "Failed to tailor resume", variant: "destructive" })
      }
    );
  };

  const handleCoverLetter = () => {
    draftCoverLetter.mutate(
      { id: jobId, data: {} },
      {
        onSuccess: () => toast({ title: "Cover letter drafting started" }),
        onError: () => toast({ title: "Failed to draft cover letter", variant: "destructive" })
      }
    );
  };

  const scorePercent = score ? Math.round(score.score * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/jobs" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground mb-4 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to pipeline
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="job-title">{job.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                <span data-testid="job-company">{job.company}</span>
              </div>
              {job.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span data-testid="job-location">{job.location}</span>
                </div>
              )}
              <Badge variant="outline" className="capitalize" data-testid="job-status-badge">{job.status}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {job.sourceUrl && (
              <Button variant="outline" size="sm" asChild data-testid="job-source-btn">
                <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                  View Source <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle>AI Pipeline Actions</CardTitle>
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button 
                variant="secondary" 
                onClick={handleParse} 
                disabled={parseJob.isPending}
                data-testid="btn-parse-jd"
              >
                {parseJob.isPending ? "Parsing..." : "Parse JD"}
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleTailor} 
                disabled={tailorResume.isPending || !job.parsedRequiredSkills}
                data-testid="btn-tailor-resume"
              >
                {tailorResume.isPending ? "Tailoring..." : "Tailor Resume"}
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleCoverLetter} 
                disabled={draftCoverLetter.isPending || !job.parsedRequiredSkills}
                data-testid="btn-draft-cl"
              >
                {draftCoverLetter.isPending ? "Drafting..." : "Draft Cover Letter"}
              </Button>
            </CardContent>
          </Card>

          <Tabs defaultValue="jd" className="w-full">
            <TabsList>
              <TabsTrigger value="jd">Job Description</TabsTrigger>
              <TabsTrigger value="parsed">Parsed Data</TabsTrigger>
              <TabsTrigger value="claims">Claim Matches</TabsTrigger>
            </TabsList>
            <TabsContent value="jd" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="whitespace-pre-wrap text-sm" data-testid="job-raw-jd">
                    {job.rawJdText || "No job description provided."}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="parsed" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {job.parsedRequiredSkills ? (
                    <>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Required Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {job.parsedRequiredSkills.map((skill, i) => (
                            <Badge key={i} variant="secondary">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                      {job.parsedNiceToHaveSkills && job.parsedNiceToHaveSkills.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Nice to Have</h4>
                          <div className="flex flex-wrap gap-2">
                            {job.parsedNiceToHaveSkills.map((skill, i) => (
                              <Badge key={i} variant="outline">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {job.parsedResponsibilities && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Responsibilities</h4>
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {job.parsedResponsibilities.map((resp, i) => (
                              <li key={i}>{resp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Run the parser to extract skills and requirements.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="claims" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Verified Claim Matches</CardTitle>
                  <CardDescription>Claims from your ledger that align with this job's requirements</CardDescription>
                </CardHeader>
                <CardContent>
                  {matchesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : claimMatches && claimMatches.length > 0 ? (
                    <div className="space-y-3">
                      {claimMatches.map((match, i) => (
                        <div key={i} className="p-3 rounded-md border bg-card space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug flex-1">{match.claim.summary}</p>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {Math.round(match.score * 100)}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground capitalize">{match.matchType}</span>
                            {match.matchedKeywords.slice(0, 5).map((kw, ki) => (
                              <span key={ki} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">
                                <Tag className="h-2.5 w-2.5" />{kw}
                              </span>
                            ))}
                          </div>
                          <Progress value={match.score * 100} className="h-1" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No claim matches. Parse the JD first, then run scoring.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Match Score</CardTitle>
            </CardHeader>
            <CardContent>
              {scoreLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : score ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <div
                      className={`text-5xl font-bold mb-1 ${
                        scorePercent! >= 70 ? "text-green-600" : scorePercent! >= 40 ? "text-yellow-600" : "text-destructive"
                      }`}
                      data-testid="job-score"
                    >
                      {scorePercent}%
                    </div>
                    <Progress value={scorePercent!} className="h-2" />
                  </div>
                  {!score.passesHardFilters && (
                    <div className="text-sm text-destructive flex items-center gap-1 mt-2">
                      <AlertCircle className="h-4 w-4" />
                      Fails hard filters
                    </div>
                  )}
                  {score.passesHardFilters && (
                    <div className="text-xs text-muted-foreground text-center">Passes hard filters</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center">Score pending — parse JD first</div>
              )}
            </CardContent>
          </Card>

          {job.parsedRequiredSkills && job.parsedRequiredSkills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Required Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {job.parsedRequiredSkills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
