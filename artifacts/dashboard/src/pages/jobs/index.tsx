import { useListJobs, useCreateJob, useScoreJob, useListRoleProfiles, getScoreJobQueryKey, type RoleProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Briefcase, MapPin, Sparkles, ArrowRight } from "lucide-react";
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
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const createJobSchema = z.object({
 title: z.string().min(1, "Title is required"),
 company: z.string().min(1, "Company is required"),
 location: z.string().optional(),
 sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
 rawJdText: z.string().optional(),
});

const ENABLE_APPLY_WIZARD = import.meta.env.VITE_ENABLE_APPLY_WIZARD === "true";

const statusStyles: Record<string, string> = {
 new: "bg-muted/40 text-foreground/80 border-border",
 parsing: "bg-warning/15 text-[hsl(var(--warning))] border-warning/30",
 tailoring: "bg-warning/15 text-[hsl(var(--warning))] border-warning/30",
 drafting: "bg-warning/15 text-[hsl(var(--warning))] border-warning/30",
 scored: "bg-secondary/15 text-[hsl(var(--secondary))] border-secondary/30",
 applied: "bg-primary/15 text-[hsl(var(--primary))] border-primary/30",
 parse_failed: "bg-destructive/15 text-[hsl(var(--destructive))] border-destructive/30",
 ready: "bg-primary/15 text-[hsl(var(--primary))] border-primary/30",
 parsed: "bg-primary/15 text-[hsl(var(--primary))] border-primary/30",
 rejected: "bg-destructive/15 text-[hsl(var(--destructive))] border-destructive/30",
 archived: "bg-destructive/15 text-[hsl(var(--destructive))] border-destructive/30",
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

function ScoreDot({ jobId, roleProfileId }: { jobId: number; roleProfileId?: number }) {
 if (!roleProfileId) return null;

 const { data: score } = useScoreJob(jobId, roleProfileId ? { roleProfileId } : undefined, {
 query: {
 enabled: !!roleProfileId,
 queryKey: roleProfileId ? [...getScoreJobQueryKey(jobId), roleProfileId] : getScoreJobQueryKey(jobId),
 },
 });

 if (!score) return null;

 const pct = Math.round(score.score);
 const colorClass =
 pct >= 70
 ? "text-[hsl(var(--primary))] bg-primary/10"
 : pct >= 40
 ? "text-[hsl(var(--warning))] bg-warning/10"
 : "text-[hsl(var(--destructive))] bg-destructive/10";

 return (
 <span
 className={cn(
 "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold font-display",
 colorClass
 )}
 title={`${pct}% match${!score.passesHardFilters ? " — fails hard filters" : ""}`}
 >
 {pct}
 </span>
 );
}

function ScoreDots({ jobId, profiles }: { jobId: number; profiles: RoleProfile[] }) {
 if (profiles.length === 0) return null;
 return (
 <div className="flex items-center gap-1">
 {profiles.slice(0, 2).map(p => (
 <ScoreDot key={p.id} jobId={jobId} roleProfileId={p.id ?? undefined} />
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
 const shouldReduceMotion = useReducedMotion();

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

 return (
 <div className="space-y-8">
 <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
 <div>
 <h1 className="text-[32px] leading-tight font-bold font-display text-foreground">
 Jobs Pipeline
 </h1>
 <p className="text-muted-foreground mt-1">
 Track and manage your job opportunities
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {ENABLE_APPLY_WIZARD && (
 <Button variant="outline" size="sm" asChild>
 <Link to="/apply-wizard">
 <Sparkles className="mr-2 h-4 w-4" />
 Open Wizard
 </Link>
 </Button>
 )}
 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
 <DialogTrigger asChild>
              <Button data-testid="btn-add-job">
                <Plus className="mr-2 h-5 w-5" />
                Ingest Job
              </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-[600px] rounded-2xl">
 <DialogHeader>
 <DialogTitle className="font-display text-xl">Ingest New Job</DialogTitle>
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
 <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={createJob.isPending}
                data-testid="btn-submit-job"
              >
                {createJob.isPending ? "Ingesting..." : "Ingest Job"}
              </Button>
 </div>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </div>
 </div>

 {isLoading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {[1, 2, 3, 4].map(i => (
 <Skeleton key={i} className="h-44 w-full rounded-[20px]" />
 ))}
 </div>
 ) : jobs?.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <span className="text-5xl mb-5">📋</span>
 <h2 className="text-xl font-bold font-display text-foreground mb-2">No jobs yet</h2>
 <p className="text-muted-foreground max-w-sm mb-6">
 Start tracking job opportunities by ingesting your first job description.
 </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Ingest Your First Job
          </Button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {jobs?.map((job, index) => (
 <motion.div
 key={job.id}
 initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
 className="card-glass cursor-pointer hover:-translate-y-1 transition-all duration-200 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)]"
 onClick={() => navigate(`/jobs/${job.id}`)}
 data-testid={`card-job-${job.id}`}
 role="link"
 tabIndex={0}
 onKeyDown={(e) => {
 if (e.key === "Enter" || e.key === " ") {
 e.preventDefault();
 navigate(`/jobs/${job.id}`);
 }
 }}
 >
 <div className="flex items-center justify-between mb-3">
 <span
 className="text-sm text-muted-foreground"
 data-testid={`text-job-company-${job.id}`}
 >
 {job.company}
 </span>
 <StatusPill status={job.status} />
 </div>
 <h3
 className="text-xl font-semibold font-display text-foreground mb-4"
 data-testid={`text-job-title-${job.id}`}
 >
 {job.title}
 </h3>
 <div className="flex items-center gap-3">
 {roleProfiles.length > 0 && (
 <ScoreDots jobId={job.id} profiles={roleProfiles} />
 )}
 {job.location && (
 <span className="flex items-center gap-1 text-sm text-muted-foreground">
 <MapPin className="h-3.5 w-3.5" />
 <span data-testid={`text-job-location-${job.id}`}>{job.location}</span>
 </span>
 )}
 <div className="flex-1" />
 <Button
 variant="ghost"
 size="sm"
 className="gap-1 text-muted-foreground hover:text-foreground"
 onClick={(e) => {
 e.stopPropagation();
 navigate(`/jobs/${job.id}`);
 }}
 >
 View <ArrowRight className="h-3.5 w-3.5" />
 </Button>
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </div>
 );
}
