import { useListApplications, useCreateApplication, useUpdateApplication, getListApplicationsQueryKey, type Application } from "@workspace/api-client-react";
import { CardContent } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus, FileText, Mail } from "lucide-react";
import { Link } from "react-router-dom";
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
import { getErrorMessage } from "@/lib/api-errors";

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
 onError: (error) =>
 toast({
 title: "Failed to update application",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
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
 onError: (error) =>
 toast({
 title: "Failed to create application",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 })
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
 <div>
  <PageHeader title="Applications" subtitle="Track submitted applications and pipeline stage.">
  <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) handleClose(); else setIsDialogOpen(true); }}>
 <DialogTrigger asChild>
 <Button data-testid="btn-add-app">
 <Plus />
 New Application
 </Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{editingId ? "Update Application" : "Create Application Tracker"}</DialogTitle>
 </DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)}>
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
 <div>
 <Button type="submit" disabled={createApplication.isPending || updateApplication.isPending} data-testid="btn-submit-app">
 {editingId ? "Update" : "Create"}
 </Button>
 </div>
 </form>
  </Form>
  </DialogContent>
  </Dialog>
  </PageHeader>

 <div data-testid="filter-app-status">
 {statuses.map((s) => (
 <Button
 key={s}
 variant={statusFilter === s ? "default" : "outline"}
 size="sm"
 onClick={() => setStatusFilter(s)}
  data-testid={`filter-status-${s}`}
  >
 {s}
 </Button>
 ))}
 </div>

 <div>
 {isLoading ? (
 <>
 <Skeleton />
 <Skeleton />
 </>
 ) : applications?.length === 0 ? (
  <div>
  <Activity />
 <h3>No applications</h3>
  <p>
 {statusFilter !== "all" ? `No ${statusFilter} applications.` : "Start tracking your submitted applications here."}
 </p>
 </div>
 ) : (
 <div>
 {applications?.map((app) => (
 <div key={app.id} data-testid={`row-app-${app.id}`}>
 <div>
 <div>
 <span>App #{app.id}</span>
 <Badge variant={STATUS_COLORS[app.status] ?? "secondary"}>
 {app.status}
 </Badge>
 <span>{app.applyMode}</span>
 </div>
 <div>
 <Link to={`/jobs/${app.jobId}`} >
 Job #{app.jobId}
 </Link>
 {app.resumeVersionId && (
 <span >
 <FileText />
 Resume <Link to="/resume-versions" >#{app.resumeVersionId}</Link>
 </span>
 )}
 {app.coverLetterVersionId && (
 <span >
 <Mail />
 Cover Letter <Link to="/cover-letters" >#{app.coverLetterVersionId}</Link>
 </span>
 )}
 {app.appliedAt && (
 <span>{new Date(app.appliedAt).toLocaleDateString()}</span>
 )}
 </div>
 {app.notes && (
 <p>{app.notes}</p>
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
