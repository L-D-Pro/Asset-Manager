import { useGetJob, useParseJobDescription, useTailorJobResume, useDraftCoverLetter, getGetJobQueryKey, useScoreJob, getScoreJobQueryKey, useGetJobClaimMatches, getGetJobClaimMatchesQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";
import { AiProgressButton } from "@/components/ai/ai-progress-button";
import { ArrowLeft, AlertCircle, Check, X, ExternalLink, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { motion, useReducedMotion } from "framer-motion";

const statusStyles: Record<string, string> = {
  new: "bg-muted/40 text-foreground/80 border-border",
  parsing: "bg-warning/15 text-warning border-warning/30",
  tailoring: "bg-warning/15 text-warning border-warning/30",
  drafting: "bg-warning/15 text-warning border-warning/30",
  scored: "bg-secondary/15 text-secondary border-secondary/30",
  applied: "bg-primary/15 text-primary border-primary/30",
  parse_failed: "bg-destructive/15 text-destructive border-destructive/30",
  ready: "bg-primary/15 text-primary border-primary/30",
  parsed: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  archived: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
 new: "New",
 parsing: "Processing",
 tailoring: "Processing",
 drafting: "Processing",
 scored: "Scored",
 applied: "Applied",
 parse_failed: "Failed",
 ready: "Ready",
 parsed: "Parsed",
 rejected: "Rejected",
 archived: "Archived",
};

function StatusPill({ status }: { status: string }) {
 const classes = statusStyles[status] ?? "bg-muted/40 text-foreground/80 border-border";
 const label = statusLabels[status] ?? status;
 return (
 <span
 className={cn(
 "inline-flex items-center text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1 border",
 classes
 )}
 >
 {label}
 </span>
 );
}

export default function JobDetail() {
 const { id } = useParams<{ id: string }>();
 const jobId = parseInt(id || "0", 10);
 const { data: job, isLoading } = useGetJob(jobId, {
 query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) },
 });
 const roleProfileId = job?.roleProfileId ?? undefined;
 const { data: score, isLoading: scoreLoading } = useScoreJob(jobId, roleProfileId ? { roleProfileId } : undefined, {
 query: {
 enabled: !!jobId && !!roleProfileId,
 queryKey: roleProfileId
 ? [...getScoreJobQueryKey(jobId), roleProfileId]
 : getScoreJobQueryKey(jobId),
 },
 });
 const { data: claimMatches, isLoading: matchesLoading } = useGetJobClaimMatches(jobId, {
 query: { enabled: !!jobId, queryKey: getGetJobClaimMatchesQueryKey(jobId) },
 });

 const parseJob = useParseJobDescription();
 const tailorResume = useTailorJobResume();
 const draftCoverLetter = useDraftCoverLetter();
 const { toast } = useToast();
 const queryClient = useQueryClient();
 
 const shouldReduceMotion = useReducedMotion();

 const researchJob = useMutation({
 mutationFn: async () => {
 const res = await fetch(`/api/jobs/${jobId}/research`, { method: "POST" });
 if (!res.ok) {
 const err = await res.json().catch(() => ({}));
 throw new Error(err.error || "Failed to research job");
 }
 return res.json();
 },
 onSuccess: () => {
 toast({ title: "Job research complete" });
 queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
 },
 onError: (error) =>
 toast({
 title: "Failed to research job",
 description: error.message,
 variant: "destructive",
 }),
 });

 const gapAnalysis = useMutation({
 mutationFn: async () => {
 const res = await fetch(`/api/jobs/${jobId}/gap-analysis`, { method: "POST" });
 if (!res.ok) {
 const err = await res.json().catch(() => ({}));
 throw new Error(err.error || "Failed to run gap analysis");
 }
 return res.json();
 },
 onSuccess: (data) => {
 toast({ title: "Gap analysis complete" });
  // Gap analysis data available in scope if needed for debugging
 },
 onError: (error) =>
 toast({
 title: "Failed to run gap analysis",
 description: error.message,
 variant: "destructive",
 }),
 });

 if (isLoading) {
 return (
 <div className="space-y-6">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-10 w-full max-w-lg" />
 <Skeleton className="h-5 w-72" />
 <Skeleton className="h-64 w-full rounded-[20px]" />
 <Skeleton className="h-48 w-full rounded-[20px]" />
 <Skeleton className="h-72 w-full rounded-[20px]" />
 </div>
 );
 }

 if (!job) {
 return (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <span className="text-4xl mb-4">🔍</span>
 <h2 className="text-xl font-bold  text-foreground mb-2">Job not found</h2>
 <Link
 to="/jobs"
 className="text-primary hover:underline font-medium"
 >
 Back to Jobs Pipeline
 </Link>
 </div>
 );
 }

 const handleParse = () => {
 parseJob.mutate(
 { id: jobId, data: {} },
 {
 onSuccess: () => {
 toast({ title: "Parsing started" });
 queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
 },
 onError: (error) =>
 toast({
 title: "Failed to parse job description",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 }
 );
 };

 const handleTailor = () => {
 tailorResume.mutate(
 { id: jobId, data: {} },
 {
 onSuccess: () => toast({ title: "Resume tailoring started" }),
 onError: (error) =>
 toast({
 title: "Failed to tailor resume",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 }
 );
 };

 const handleCoverLetter = () => {
 draftCoverLetter.mutate(
 { id: jobId, data: {} },
 {
 onSuccess: () => toast({ title: "Cover letter drafting started" }),
 onError: (error) =>
 toast({
 title: "Failed to draft cover letter",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 }
 );
 };

 const scorePercent = score ? Math.round(score.score) : null;

 return (
  <div className="space-y-6 p-6">
  {/* Header */}
  <Link
  to="/jobs"
  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors font-medium"
  >
  <ArrowLeft className="h-4 w-4" /> Back to Jobs
  </Link>
  <PageHeader
  title={job.title}
  subtitle={[job.company, job.location].filter(Boolean).join(" · ")}
  variant="hero"
  >
  <StatusPill status={job.status} />
  {job.sourceUrl && (
  <Button variant="outline" size="sm" asChild data-testid="job-source-btn">
  <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
  View Source <ExternalLink className="ml-2 h-3.5 w-3.5" />
  </a>
  </Button>
  )}
  </PageHeader>

 {/* Score & Match card */}
 <motion.div
 initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
 className="card-glass"
 >
 <h2 className="text-lg font-bold  text-foreground mb-5">Score &amp; Match</h2>

 {scoreLoading ? (
 <div className="flex flex-col items-center gap-3 py-4">
 <Skeleton className="h-28 w-28 rounded-full" />
 <Skeleton className="h-5 w-32" />
 <Skeleton className="h-4 w-48" />
 </div>
 ) : score ? (
 <div className="space-y-5">
 <div className="flex flex-col items-center">
 <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
 <svg
 width={120}
 height={120}
 className="-rotate-90"
 viewBox="0 0 120 120"
 >
 <circle
 cx={60}
 cy={60}
 r={52}
 fill="none"
 stroke="hsl(var(--border))"
 strokeWidth={10}
 />
 <circle
 cx={60}
 cy={60}
 r={52}
 fill="none"
 stroke="currentColor"
 strokeWidth={10}
 strokeDasharray={2 * Math.PI * 52}
 strokeDashoffset={2 * Math.PI * 52 * (1 - scorePercent! / 100)}
 strokeLinecap="round"
 className={cn(
 scorePercent! >= 70
 ? "text-primary"
 : scorePercent! >= 40
 ? "text-warning"
 : "text-destructive"
 )}
 style={{ transition: "stroke-dashoffset 0.7s ease-out" }}
 />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <span
 className="text-3xl font-extrabold  text-foreground"
 data-testid="job-score"
 >
 {scorePercent}%
 </span>
 </div>
 </div>
 <p className="text-sm text-muted-foreground mt-2">Role profile match</p>

 <div className="flex items-center gap-2 mt-2">
 {score.passesHardFilters ? (
 <>
 <Check className="h-4 w-4 text-primary" />
 <span className="text-sm text-primary font-medium">Passes hard filters</span>
 </>
 ) : (
 <>
 <AlertCircle className="h-4 w-4 text-destructive" />
 <span className="text-sm text-destructive font-medium">Fails hard filters</span>
 </>
 )}
 </div>
 </div>

 {score.matchedSkills.length > 0 && (
 <div>
 <h4 className="text-sm font-semibold text-foreground mb-2">Matching Skills</h4>
 <div className="flex flex-wrap gap-1.5">
 {score.matchedSkills.map((skill, i) => (
 <span
 key={i}
 className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-3 py-1 bg-primary/10 text-primary border border-primary/20"
 >
 <Check className="h-3 w-3" />
 {skill}
 </span>
 ))}
 </div>
 </div>
 )}

 {score.unmatchedRequiredSkills.length > 0 && (
 <div>
 <h4 className="text-sm font-semibold text-foreground mb-2">Missing Required</h4>
 <div className="flex flex-wrap gap-1.5">
 {score.unmatchedRequiredSkills.map((skill, i) => (
 <span
 key={i}
 className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-3 py-1 bg-destructive/10 text-destructive border border-destructive/20"
 >
 <X className="h-3 w-3" />
 {skill}
 </span>
 ))}
 </div>
 </div>
 )}

 {score.matchedNiceToHaveSkills.length > 0 && (
 <div>
 <h4 className="text-sm font-semibold text-foreground mb-2">Nice to Have</h4>
 <div className="flex flex-wrap gap-1.5">
 {score.matchedNiceToHaveSkills.map((skill, i) => (
 <span
 key={i}
 className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20"
 >
 <Check className="h-3 w-3" />
 {skill}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 ) : roleProfileId ? (
 <div className="text-center py-6">
 <p className="text-sm text-muted-foreground">Score pending — parse JD first</p>
 </div>
 ) : (
 <div className="text-center py-6">
 <p className="text-sm text-muted-foreground">Assign a role profile to see match scoring</p>
 </div>
 )}
 </motion.div>

 {/* AI Actions card */}
 <motion.div
 initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
 className="card-glass"
 >
 <h2 className="text-lg font-bold  text-foreground mb-4">AI Actions</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <AiProgressButton
 variant="secondary"
 onClick={handleParse}
 isPending={parseJob.isPending}
 idleLabel="Parse JD"
 data-testid="btn-parse-jd"
 />
 <AiProgressButton
 variant="secondary"
 onClick={() => researchJob.mutate()}
 isPending={researchJob.isPending}
 idleLabel="Research"
 />
 <AiProgressButton
 variant="secondary"
 onClick={() => gapAnalysis.mutate()}
 isPending={gapAnalysis.isPending}
 disabled={!job.parsedRequiredSkills || job.parsedRequiredSkills.length === 0}
 idleLabel="Gap Analysis"
 />
 <AiProgressButton
 variant="default"
 onClick={handleTailor}
 isPending={tailorResume.isPending}
 disabled={!job.parsedRequiredSkills}
 idleLabel="Tailor Resume"
 data-testid="btn-tailor-resume"
 />
 <AiProgressButton
 variant="default"
 onClick={handleCoverLetter}
 isPending={draftCoverLetter.isPending}
 disabled={!job.parsedRequiredSkills}
 idleLabel="Draft Cover Letter"
 data-testid="btn-draft-cl"
 wrapperClassName="md:col-span-2"
 />
 </div>
 </motion.div>

 {/* Job Details tabs */}
 <motion.div
 initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
 >
 <div className="card-glass">
 <Tabs defaultValue="jd" className="w-full">
 <TabsList className="w-full justify-start gap-1 bg-transparent border-b border-border pb-0 mb-0 rounded-none h-auto">
 <TabsTrigger
 value="jd"
 className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 Job Description
 </TabsTrigger>
 <TabsTrigger
 value="parsed"
 className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 Parsed Data
 </TabsTrigger>
 <TabsTrigger
 value="research"
 className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 Research
 </TabsTrigger>
 <TabsTrigger
 value="claims"
 className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 Claim Matches
 </TabsTrigger>
 </TabsList>

 <TabsContent value="jd" className="pt-4">
 <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80" data-testid="job-raw-jd">
 {job.rawJdText || "No job description provided."}
 </div>
 </TabsContent>

 <TabsContent value="parsed" className="pt-4">
 <div className="space-y-6">
 {job.parsedRequiredSkills ? (
 <>
 <div>
 <h4 className="font-semibold text-sm mb-2 text-foreground">Required Skills</h4>
 <div className="flex flex-wrap gap-2">
 {job.parsedRequiredSkills.map((skill, i) => (
 <span
 key={i}
 className="inline-flex items-center text-xs font-medium rounded-full px-3 py-1 bg-primary/10 text-primary border border-primary/20"
 >
 {skill}
 </span>
 ))}
 </div>
 </div>
 {job.parsedNiceToHaveSkills && job.parsedNiceToHaveSkills.length > 0 && (
 <div>
 <h4 className="font-semibold text-sm mb-2 text-foreground">Nice to Have</h4>
 <div className="flex flex-wrap gap-2">
 {job.parsedNiceToHaveSkills.map((skill, i) => (
 <span
 key={i}
 className="inline-flex items-center text-xs font-medium rounded-full px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20"
 >
 {skill}
 </span>
 ))}
 </div>
 </div>
 )}
 {job.parsedResponsibilities && (
 <div>
 <h4 className="font-semibold text-sm mb-2 text-foreground">Responsibilities</h4>
 <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
 {job.parsedResponsibilities.map((resp, i) => (
 <li key={i}>{resp}</li>
 ))}
 </ul>
 </div>
 )}
 </>
 ) : (
 <div className="text-sm text-muted-foreground py-4">
 Run the parser to extract skills and requirements.
 </div>
 )}
 </div>
 </TabsContent>

 <TabsContent value="research" className="pt-4">
 <div className="space-y-6">
 {(() => {
 const rd = job.researchData as Record<string, unknown> | null;
 return rd ? (
 <div className="space-y-6 text-sm">
 {typeof rd.companyOverview === "string" && (
 <div>
 <h4 className="font-semibold text-lg mb-1 text-primary">Company Overview</h4>
 <p className="text-muted-foreground leading-relaxed">{rd.companyOverview}</p>
 </div>
 )}
 {typeof rd.recentNewsOrProjects === "string" && (
 <div>
 <h4 className="font-semibold text-lg mb-1 text-primary">Recent News</h4>
 <p className="text-muted-foreground leading-relaxed">{rd.recentNewsOrProjects}</p>
 </div>
 )}
 {typeof rd.interviewStrategy === "string" && (
 <div>
 <h4 className="font-semibold text-lg mb-1 text-primary">Interview Strategy</h4>
 <p className="text-muted-foreground leading-relaxed">{rd.interviewStrategy}</p>
 </div>
 )}
 </div>
 ) : (
 <div className="text-sm text-muted-foreground py-4">
 Click &lsquo;Research&rsquo; to gather real-world intelligence on this role.
 </div>
 );
 })()}
 </div>
 </TabsContent>

 <TabsContent value="claims" className="pt-4">
 <div>
 {matchesLoading ? (
 <div className="space-y-3">
 <Skeleton className="h-20 w-full" />
 <Skeleton className="h-20 w-full" />
 <Skeleton className="h-20 w-full" />
 </div>
 ) : claimMatches && claimMatches.length > 0 ? (
 <div className="space-y-3">
 {claimMatches.map((match, i) => (
  <div key={i} className="card-glass p-4 space-y-2">
 <div className="flex items-start justify-between gap-2">
 <p className="text-sm font-medium leading-snug flex-1 text-foreground">
 {match.claim.summary}
 </p>
 <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 shrink-0">
 {match.score} pts
 </span>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs text-muted-foreground capitalize">{match.matchType}</span>
 {match.matchedKeywords.slice(0, 5).map((kw, ki) => (
 <span
 key={ki}
 className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5"
 >
 <Tag className="h-2.5 w-2.5" />
 {kw}
 </span>
 ))}
 </div>
 <Progress value={Math.min(match.score * 10, 100)} className="h-1" />
 </div>
 ))}
 </div>
 ) : (
 <div className="text-sm text-muted-foreground py-4">
 No claim matches. Parse the JD first, then run scoring.
 </div>
 )}
 </div>
 </TabsContent>
 </Tabs>
 </div>
 </motion.div>
 </div>
 );
}
