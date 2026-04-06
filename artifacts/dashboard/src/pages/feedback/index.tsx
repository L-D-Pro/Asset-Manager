import { useListFeedbackSignals, useCreateFeedbackSignal, getListFeedbackSignalsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const signalSchema = z.object({
  applicationId: z.coerce.number().min(1, "App ID is required"),
  signalType: z.string().min(1, "Signal type is required"),
  outcome: z.string().min(1, "Outcome is required"),
});

export default function FeedbackPage() {
  const { data: signals, isLoading } = useListFeedbackSignals();
  const createSignal = useCreateFeedbackSignal();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof signalSchema>>({
    resolver: zodResolver(signalSchema),
    defaultValues: { applicationId: 0, signalType: "response", outcome: "positive" },
  });

  const onSubmit = (data: z.infer<typeof signalSchema>) => {
    createSignal.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Feedback logged" });
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListFeedbackSignalsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback Signals</h1>
          <p className="text-muted-foreground mt-1">Log outcomes to improve future matching.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-signal"><Plus className="mr-2 h-4 w-4"/>Log Signal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Feedback Signal</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="applicationId" render={({field}) => (
                  <FormItem><FormLabel>Application ID</FormLabel>
                  <FormControl><Input type="number" {...field}/></FormControl></FormItem>
                )}/>
                <FormField control={form.control} name="signalType" render={({field}) => (
                  <FormItem><FormLabel>Signal Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
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
                  <FormItem><FormLabel>Outcome</FormLabel>
                  <FormControl><Input {...field}/></FormControl></FormItem>
                )}/>
                <Button type="submit" className="w-full" disabled={createSignal.isPending}>Log Feedback</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-2">
          {signals?.map(s => (
            <Card key={s.id} className="bg-card">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <span className="font-semibold">App #{s.applicationId}</span>
                  <span className="text-sm border px-2 py-1 rounded bg-muted">{s.signalType}</span>
                  <span className="text-sm text-muted-foreground">{s.outcome}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
