import { useListJobs, useCreateJob } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Plus, Briefcase, MapPin, Building, ExternalLink } from "lucide-react";
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

const createJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  location: z.string().optional(),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  rawJdText: z.string().optional(),
});

export default function JobsPage() {
  const { data: jobs, isLoading } = useListJobs();
  const createJob = useCreateJob();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        onError: () => {
          toast({ title: "Failed to ingest job", variant: "destructive" });
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="secondary" data-testid={`job-status-${status}`}>New</Badge>;
      case "parsing":
      case "tailoring":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800" data-testid={`job-status-${status}`}>Processing</Badge>;
      case "ready":
      case "parsed":
      case "scored":
        return <Badge variant="outline" className="bg-green-100 text-green-800" data-testid={`job-status-${status}`}>Ready</Badge>;
      case "applied":
        return <Badge variant="default" data-testid={`job-status-${status}`}>Applied</Badge>;
      case "archived":
        return <Badge variant="destructive" data-testid={`job-status-${status}`}>Archived</Badge>;
      default:
        return <Badge variant="outline" data-testid={`job-status-${status}`}>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage and parse your job opportunities.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-job">
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
                  <Button type="submit" disabled={createJob.isPending} data-testid="btn-submit-job">
                    {createJob.isPending ? "Ingesting..." : "Ingest Job"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : jobs?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No jobs yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Ingest your first job description to start the parsing and tailoring pipeline.
            </p>
          </Card>
        ) : (
          jobs?.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" data-testid={`card-job-${job.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg" data-testid={`text-job-title-${job.id}`}>{job.title}</h3>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          <span data-testid={`text-job-company-${job.id}`}>{job.company}</span>
                        </div>
                        {job.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span data-testid={`text-job-location-${job.id}`}>{job.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>Added {format(new Date(job.createdAt), "MMM d, yyyy")}</span>
                        </div>
                        {job.parsedRequiredSkills && job.parsedRequiredSkills.length > 0 && (
                          <span className="text-xs">{job.parsedRequiredSkills.length} required skills</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                      {job.sourceUrl && (
                        <a 
                          href={job.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`link-job-source-${job.id}`}
                        >
                          Original Post <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
