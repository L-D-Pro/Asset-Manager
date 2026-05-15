import { useListFeedbackSignals, useCreateFeedbackSignal, getListFeedbackSignalsQueryKey } from "@workspace/api-client-react";
import { CardContent } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { getErrorMessage } from "@/lib/api-errors";

const signalSchema = z.object({
 applicationId: z.coerce.number().min(1, "App ID is required"),
 resumeVersionId: z.coerce.number().min(1, "Resume version ID is required"),
 signalType: z.string().min(1, "Signal type is required"),
 outcome: z.string().min(1, "Outcome is required"),
 notes: z.string().optional(),
});

const SIGNAL_COLORS: Record<string, string> = {
  response: "bg-primary/10 text-primary",
  interview: "bg-success/10 text-success",
  offer: "bg-success/10 text-success",
  rejection: "bg-destructive/10 text-destructive",
};

const OUTCOME_OPTIONS = [
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "ghosted", label: "Ghosted" },
  { value: "no_response", label: "No Response" },
];

export default function FeedbackPage() {
 const { data: signals, isLoading } = useListFeedbackSignals();
 const createSignal = useCreateFeedbackSignal();
 const [isDialogOpen, setIsDialogOpen] = useState(false);
 const { toast } = useToast();
 const queryClient = useQueryClient();

 const form = useForm<z.infer<typeof signalSchema>>({
 resolver: zodResolver(signalSchema),
 defaultValues: {
 applicationId: 0,
 resumeVersionId: 0,
 signalType: "response",
 outcome: "interview",
 notes: "",
 },
 });

 const onSubmit = (data: z.infer<typeof signalSchema>) => {
 createSignal.mutate({ data }, {
 onSuccess: () => {
 toast({ title: "Feedback logged" });
 setIsDialogOpen(false);
 form.reset({ applicationId: 0, resumeVersionId: 0, signalType: "response", outcome: "interview", notes: "" });
 queryClient.invalidateQueries({ queryKey: getListFeedbackSignalsQueryKey() });
 },
 onError: (error) =>
 toast({
 title: "Failed to log feedback signal",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 })
 });
 };

 return (
 <div>
 <PageHeader
 title="Feedback Signals"
 subtitle="Review and curate feedback used for AI learning."
 variant="data"
 >
 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
 <DialogTrigger asChild>
 <Button data-testid="btn-add-signal"><Plus/>Log Signal</Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader><DialogTitle>Log Feedback Signal</DialogTitle></DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)}>
 <FormField control={form.control} name="applicationId" render={({field}) => (
 <FormItem>
 <FormLabel>Application ID</FormLabel>
 <FormControl><Input type="number" {...field} data-testid="input-signal-appid"/></FormControl>
 <FormMessage />
 </FormItem>
 )}/>
 <FormField control={form.control} name="resumeVersionId" render={({field}) => (
 <FormItem>
 <FormLabel>Resume Version ID</FormLabel>
 <FormControl><Input type="number" {...field} data-testid="input-signal-resume-version"/></FormControl>
 <FormMessage />
 </FormItem>
 )}/>
 <div>
 <FormField control={form.control} name="signalType" render={({field}) => (
 <FormItem>
 <FormLabel>Signal Type</FormLabel>
 <Select onValueChange={field.onChange} value={field.value}>
 <FormControl>
 <SelectTrigger data-testid="select-signal-type">
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="response">Response</SelectItem>
 <SelectItem value="interview">Interview</SelectItem>
 <SelectItem value="offer">Offer</SelectItem>
 <SelectItem value="rejection">Rejection</SelectItem>
 </SelectContent>
 </Select>
 </FormItem>
 )}/>
 <FormField control={form.control} name="outcome" render={({field}) => (
 <FormItem>
 <FormLabel>Outcome</FormLabel>
 <Select onValueChange={field.onChange} value={field.value}>
 <FormControl>
 <SelectTrigger data-testid="select-signal-outcome">
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {OUTCOME_OPTIONS.map((option) => (
 <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </FormItem>
 )}/>
 </div>
 <FormField control={form.control} name="notes" render={({field}) => (
 <FormItem>
 <FormLabel>Notes</FormLabel>
 <FormControl>
 <Textarea
 {...field}
 placeholder="What happened? Any specific feedback from recruiter or hiring manager?"
 data-testid="input-signal-notes"
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}/>
 <Button type="submit" disabled={createSignal.isPending} data-testid="btn-submit-signal">
 {createSignal.isPending ? "Logging…" : "Log Feedback"}
 </Button>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </PageHeader>

 {isLoading ? (
 <div>
 <Skeleton />
 <Skeleton />
 </div>
 ) : signals?.length === 0 ? (
  <div>
  <Activity />
  <h3>No feedback signals yet</h3>
  <p>Log your first application outcome to start building signal data.</p>
  </div>
 ) : (
  <div>
 {signals?.map(s => (
 <div key={s.id} data-testid={`row-signal-${s.id}`}>
 <div>
 <span>App #{s.applicationId}</span>
 <span>
 {s.signalType}
 </span>
 <span>{s.outcome}</span>
 {s.createdAt && (
 <span>{format(new Date(s.createdAt), "MMM d, yyyy")}</span>
 )}
 </div>
 {s.notes && (
 <p>{s.notes}</p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
