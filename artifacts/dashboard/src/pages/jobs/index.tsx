import { useListJobs, useCreateJob, useScoreJob, useListRoleProfiles, getScoreJobQueryKey, type RoleProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Briefcase, MapPin, Building, ExternalLink, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListJobsQueryKey } from "@workspace/api-client-react";
import { getErrorMessage } from "@/lib/api-errors";

const createJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  location: z.string().optional(),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  rawJdText: z.string().optional(),
});

const ENABLE_APPLY_WIZARD = import.meta.env.VITE_ENABLE_APPLY_WIZARD === "true";

function JobScoreChip({ jobId, roleProfileId, profileName }: { jobId: number; roleProfileId?: number; profileName?: string }) {
  if (!roleProfileId) {
    return null;
  }

  const { data: score } = useScoreJob(jobId, roleProfileId ? { roleProfileId } : undefined, {
    query: {
      enabled: !!roleProfileId,
      queryKey: roleProfileId ? [...getScoreJobQueryKey(jobId), roleProfileId] : getScoreJobQueryKey(jobId),
    },
  });

  if (!score) return null;

  const pct = Math.round(score.score);
  const color =
    pct >= 70
      ? "text-success dark:text-success border-success/25 bg-success/10"
      : pct >= 40
      ? "text-warning dark:text-warning border-warning/25 bg-warning/10"
      : "text-destructive dark:text-destructive border-destructive/25 bg-destructive/10";

  return (
    <span
      className={`text-xs font-bold border rounded px-1.5 py-0.5 ${color}`}
      title={`${profileName ? `${profileName}: ` : ""}match score${!score.passesHardFilters ? " — fails hard filters" : ""}`}
      data-testid={`job-score-chip-${jobId}${roleProfileId ? `-${roleProfileId}` : ""}`}
    >
      {profileName && <span className="font-normal mr-1">{profileName}</span>}
      {pct}%{!score.passesHardFilters ? " ✗" : ""}
    </span>
  );
}

function JobScoreChips({ jobId, profiles }: { jobId: number; profiles: RoleProfile[] }) {
  if (profiles.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {profiles.map(p => (
        <JobScoreChip key={p.id} jobId={jobId} roleProfileId={p.id} profileName={p.name} />
      ))}
    </div>
  );
}

export default function JobsPage() {
  const { data: jobs, isLoading } = useListJobs();
  const { data: roleProfiles = [] } = useListRoleProfiles();
  const createJob = useCreateJob();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof createJobSchema>>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      title: "",
      company: "",
      location: "",
      sourceUrl: "",
      rawJdText: "",
    },
  });

  const onSubmit = (data: z.infer<typeof createJobSchema>) => {
    createJob.mutate(
      { data: { ...data, status: "new" } },
      {
        onSuccess: () => {
          toast({ title: "Job ingested successfully" });
          setIsDialogOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        },
        onError: (error) => {
          toast({
            title: "Failed to ingest job",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          });
        },
      }
    );
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "parsing": case "tailoring": return "Processing";
      case "ready": case "parsed": case "scored": return "Ready";
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Jobs Pipeline"
        subtitle="Manage and parse your job opportunities."
        variant="data"
      >
        <div className="flex items-center gap-2">
          {ENABLE_APPLY_WIZARD && (
            <Button variant="outline" size="sm" asChild className="rounded-md border-border hover:border-primary/35 hover:bg-primary/5">
              <Link to="/apply-wizard">
                <Sparkles className="mr-2 h-4 w-4" />
                Open Wizard
              </Link>
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                data-testid="btn-add-job"
                className="rounded-md font-semibold shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Ingest Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Ingest New Job</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Software Engineer" {...field} data-testid="input-job-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Corp" {...field} data-testid="input-job-company" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location / Remote</FormLabel>
                        <FormControl>
                          <Input placeholder="San Francisco, CA or Remote" {...field} data-testid="input-job-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sourceUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} data-testid="input-job-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rawJdText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raw Job Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Paste the full job description here..."
                            className="h-32"
                            {...field}
                            data-testid="input-job-jd"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={createJob.isPending}
                      data-testid="btn-submit-job"
                      className="rounded-md shadow-sm"
                    >
                      {createJob.isPending ? "Ingesting..." : "Ingest Job"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <StaggerContainer className="grid gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </>
        ) : jobs?.length === 0 ? (
          <ContentCard>
            <EmptyState
              icon={<Briefcase className="h-8 w-8" />}
              title="No jobs yet"
              description="Ingest your first job description to start the parsing and tailoring pipeline."
              action={{ label: "Ingest Job", onClick: () => setIsDialogOpen(true) }}
            />
          </ContentCard>
        ) : (
          jobs?.map((job, index) => (
            <StaggerItem key={job.id}>
              <div
                className="cursor-pointer"
                data-testid={`card-job-${job.id}`}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/jobs/${job.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/jobs/${job.id}`);
                  }
                }}
              >
                <ContentCard index={index} className="gamify-radius-chunky gamify-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-foreground" data-testid={`text-job-title-${job.id}`}>
                          {job.title}
                        </h3>
                        <StatusBadge status={statusLabel(job.status)} />
                        <JobScoreChips jobId={job.id} profiles={roleProfiles} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5" />
                          <span data-testid={`text-job-company-${job.id}`}>{job.company}</span>
                        </div>
                        {job.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span data-testid={`text-job-location-${job.id}`}>{job.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span>Added {format(new Date(job.createdAt), "MMM d, yyyy")}</span>
                        </div>
                        {job.parsedRequiredSkills && job.parsedRequiredSkills.length > 0 && (
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                            {job.parsedRequiredSkills.length} skills
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                      {job.sourceUrl && (
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 text-primary hover:text-primary/85 font-medium transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`link-job-source-${job.id}`}
                        >
                          Original Post <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </ContentCard>
              </div>
            </StaggerItem>
          ))
        )}
      </StaggerContainer>
    </div>
  );
}
