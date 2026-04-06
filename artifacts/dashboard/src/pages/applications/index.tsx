import { useListApplications, useCreateApplication, useUpdateApplication, getListApplicationsQueryKey, type Application } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus, FileText, Mail } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const appSchema = z.object({
  jobId: z.coerce.number().min(1, "Job ID is required"),
  status: z.string().min(1, "Status is required"),
  applyMode: z.string().min(1, "Apply mode is required"),
  notes: z.string().optional(),
});

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  offer: "default",
  interviewing: "default",
  submitted: "secondary",
  draft: "secondary",
  rejected: "destructive",
  withdrawn: "outline",
};

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: applications, isLoading } = useListApplications(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const createApplication = useCreateApplication();
  const updateApplication = useUpdateApplication();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof appSchema>>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      jobId: 0,
      status: "draft",
      applyMode: "manual",
      notes: "",
    },
  });

  const onSubmit = (data: z.infer<typeof appSchema>) => {
    if (editingId) {
      updateApplication.mutate(
        { id: editingId, data },
        {
          onSuccess: () => {
            toast({ title: "Application updated" });
            handleClose();
            queryClient.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
          },
        }
      );
    } else {
      createApplication.mutate(
        { data },
        {
          onSuccess: () => {
            toast({ title: "Application created" });
            handleClose();
            queryClient.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
          },
          onError: () => toast({ title: "Error creating application", variant: "destructive" })
        }
      );
    }
  };

  const handleEdit = (app: Application) => {
    setEditingId(app.id);
    form.reset({
      jobId: app.jobId,
      status: app.status,
      applyMode: app.applyMode || "manual",
      notes: app.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    form.reset({ jobId: 0, status: "draft", applyMode: "manual", notes: "" });
  };

  const statuses = ["all", "draft", "submitted", "interviewing", "offer", "rejected", "withdrawn"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground mt-1">Track submitted applications and pipeline stage.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) handleClose(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-app">
              <Plus className="mr-2 h-4 w-4" />
              New Application
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Update Application" : "Create Application Tracker"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job ID</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} disabled={!!editingId} data-testid="input-app-jobid" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-app-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="interviewing">Interviewing</SelectItem>
                          <SelectItem value="offer">Offer</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applyMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apply Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-app-mode">
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="assisted">Assisted (AI)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any notes about this application..." {...field} data-testid="input-app-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createApplication.isPending || updateApplication.isPending} data-testid="btn-submit-app">
                    {editingId ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap" data-testid="filter-app-status">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
            data-testid={`filter-status-${s}`}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : applications?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No applications</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {statusFilter !== "all" ? `No ${statusFilter} applications.` : "Start tracking your submitted applications here."}
            </p>
          </Card>
        ) : (
          <div className="border rounded-md divide-y bg-card">
            {applications?.map((app) => (
              <div key={app.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors" data-testid={`row-app-${app.id}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">App #{app.id}</span>
                    <Badge variant={STATUS_COLORS[app.status] ?? "secondary"} className="capitalize">
                      {app.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">{app.applyMode}</span>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                    <Link href={`/jobs/${app.jobId}`} className="text-primary hover:underline">
                      Job #{app.jobId}
                    </Link>
                    {app.resumeVersionId && (
                      <span className="flex items-center gap-1 text-xs">
                        <FileText className="h-3 w-3" />
                        Resume <Link href="/resume-versions" className="text-primary hover:underline">#{app.resumeVersionId}</Link>
                      </span>
                    )}
                    {app.coverLetterVersionId && (
                      <span className="flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3" />
                        Cover Letter <Link href="/cover-letters" className="text-primary hover:underline">#{app.coverLetterVersionId}</Link>
                      </span>
                    )}
                    {app.appliedAt && (
                      <span className="text-xs">{new Date(app.appliedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  {app.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{app.notes}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(app)} data-testid={`btn-edit-app-${app.id}`}>Edit</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
