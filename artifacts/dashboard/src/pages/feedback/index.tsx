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
  response: "bg-blue-100 text-blue-800",
  interview: "bg-green-100 text-green-800",
  offer: "bg-emerald-100 text-emerald-800",
  rejection: "bg-red-100 text-red-800",
};

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
      outcome: "positive",
      notes: "",
    },
  });

  const onSubmit = (data: z.infer<typeof signalSchema>) => {
    createSignal.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Feedback logged" });
        setIsDialogOpen(false);
        form.reset({ applicationId: 0, resumeVersionId: 0, signalType: "response", outcome: "positive", notes: "" });
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
    <div className="space-y-8">
      <PageHeader
        title="Feedback Signals"
        subtitle="Review and curate feedback used for AI learning."
        gradient="from-indigo-600 via-indigo-500 to-violet-500"
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-signal" className="bg-white/20 border-white/40 text-white hover:bg-white/30"><Plus className="mr-2 h-4 w-4"/>Log Signal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Feedback Signal</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                          <SelectItem value="positive">Positive</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="negative">Negative</SelectItem>
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
                        className="h-24"
                        data-testid="input-signal-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <Button type="submit" className="w-full" disabled={createSignal.isPending} data-testid="btn-submit-signal">
                  {createSignal.isPending ? "Logging…" : "Log Feedback"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : signals?.length === 0 ? (
        <ContentCard className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No feedback signals yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Log your first application outcome to start building signal data.</p>
        </ContentCard>
      ) : (
        <div className="border rounded-md divide-y bg-card">
          {signals?.map(s => (
            <div key={s.id} className="p-4 space-y-1" data-testid={`row-signal-${s.id}`}>
              <div className="flex items-center gap-3">
                <span className="font-semibold">App #{s.applicationId}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SIGNAL_COLORS[s.signalType] ?? "bg-muted text-muted-foreground"}`}>
                  {s.signalType}
                </span>
                <span className="text-sm text-muted-foreground capitalize">{s.outcome}</span>
                {s.createdAt && (
                  <span className="text-xs text-muted-foreground ml-auto">{format(new Date(s.createdAt), "MMM d, yyyy")}</span>
                )}
              </div>
              {s.notes && (
                <p className="text-sm text-muted-foreground pl-1">{s.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
