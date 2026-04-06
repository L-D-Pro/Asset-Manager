import { useListAiModelConfigs, useCreateAiModelConfig, useUpdateAiModelConfig, useDeleteAiModelConfig, getListAiModelConfigsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const configSchema = z.object({
  taskScope: z.string().min(1, "Task scope is required"),
  provider: z.string().min(1, "Provider is required"),
  modelName: z.string().min(1, "Model name is required"),
});

export default function AiConfigPage() {
  const { data: configs, isLoading } = useListAiModelConfigs();
  const createConfig = useCreateAiModelConfig();
  const updateConfig = useUpdateAiModelConfig();
  const deleteConfig = useDeleteAiModelConfig();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof configSchema>>({
    resolver: zodResolver(configSchema),
    defaultValues: { taskScope: "", provider: "openrouter", modelName: "" },
  });

  const onSubmit = (data: z.infer<typeof configSchema>) => {
    if (editingId) {
      updateConfig.mutate({ id: editingId, data }, {
        onSuccess: () => {
          toast({ title: "Config updated" });
          handleClose();
          queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
        }
      });
    } else {
      createConfig.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "Config created" });
          handleClose();
          queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
        }
      });
    }
  };

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    form.reset({ taskScope: c.taskScope, provider: c.provider, modelName: c.modelName });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if(confirm("Delete config?")) {
      deleteConfig.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() })
      });
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Model Config</h1>
          <p className="text-muted-foreground mt-1">Configure models used for different pipelines.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) handleClose(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-config"><Plus className="mr-2 h-4 w-4"/>New Config</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Config" : "New Config"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="taskScope" render={({field}) => (
                  <FormItem><FormLabel>Task Scope (e.g. jd_parsing, resume_tailoring)</FormLabel>
                  <FormControl><Input {...field} data-testid="input-config-scope"/></FormControl></FormItem>
                )}/>
                <FormField control={form.control} name="provider" render={({field}) => (
                  <FormItem><FormLabel>Provider</FormLabel>
                  <FormControl><Input {...field} data-testid="input-config-provider"/></FormControl></FormItem>
                )}/>
                <FormField control={form.control} name="modelName" render={({field}) => (
                  <FormItem><FormLabel>Model Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-config-model"/></FormControl></FormItem>
                )}/>
                <Button type="submit" className="w-full" data-testid="btn-submit-config">Save Config</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {configs?.map(c => (
            <Card key={c.id}>
              <CardContent className="p-6 flex justify-between items-start">
                <div>
                  <Badge className="mb-2">{c.taskScope}</Badge>
                  <div className="font-semibold">{c.modelName}</div>
                  <div className="text-sm text-muted-foreground">{c.provider}</div>
                </div>
                <div className="flex">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
