import { useListApplications, useCreateApplication, useUpdateApplication, getListApplicationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function ApplicationsPage() {
  const { data: applications, isLoading } = useListApplications();
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

  const handleEdit = (app: any) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground mt-1">Track your submitted applications and their status.</p>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <FormControl>
                        <Input {...field} data-testid="input-app-mode" />
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

      <div className="grid gap-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : applications?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No applications</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Start tracking your submitted applications here.
            </p>
          </Card>
        ) : (
          <div className="border rounded-md divide-y bg-card">
            {applications?.map((app) => (
              <div key={app.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors" data-testid={`row-app-${app.id}`}>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">App #{app.id}</span>
                    <Badge variant={app.status === 'offer' ? 'default' : app.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {app.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span>Job <Link href={`/jobs/${app.jobId}`} className="text-primary hover:underline">#{app.jobId}</Link></span>
                    <span>•</span>
                    <span>{app.applyMode}</span>
                  </div>
                </div>
                <div>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(app)} data-testid={`btn-edit-app-${app.id}`}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
