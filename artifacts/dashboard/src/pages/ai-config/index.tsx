import { useListAiModelConfigs, useCreateAiModelConfig, useUpdateAiModelConfig, useDeleteAiModelConfig, getListAiModelConfigsQueryKey, type AiModelConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Settings, Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";

const TASK_SCOPES = [
  "default",
  "jd_parsing",
  "resume_tailoring",
  "cover_letter",
  "claim_generation",
  "job_fit_scoring",
  "proposal_drafting",
  "project_fit_scoring",
  "validation",
];

const configSchema = z.object({
  taskScope: z.string().min(1, "Task scope is required"),
  provider: z.string().min(1, "Provider is required"),
  modelName: z.string().min(1, "Model name is required"),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).default(0),
  costPerInputToken: z.string().optional(),
  costPerOutputToken: z.string().optional(),
  fallbackModelId: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof configSchema>;

export default function AiConfigPage() {
  const { data: configs, isLoading } = useListAiModelConfigs();
  const createConfig = useCreateAiModelConfig();
  const updateConfig = useUpdateAiModelConfig();
  const deleteConfig = useDeleteAiModelConfig();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCustomScope, setIsCustomScope] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      taskScope: "default",
      provider: "openrouter",
      modelName: "",
      isActive: true,
      priority: 0,
      costPerInputToken: "",
      costPerOutputToken: "",
      fallbackModelId: null,
    },
  });

  const buildPayload = (data: FormValues) => ({
    taskScope: data.taskScope,
    provider: data.provider,
    modelName: data.modelName,
    isActive: data.isActive,
    priority: data.priority,
    costPerInputToken: data.costPerInputToken || undefined,
    costPerOutputToken: data.costPerOutputToken || undefined,
    fallbackModelId: data.fallbackModelId || undefined,
  });

  const onSubmit = (data: FormValues) => {
    const payload = buildPayload(data);
    if (editingId) {
      updateConfig.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          toast({ title: "Config updated" });
          handleClose();
          queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
        },
        onError: (error) =>
          toast({
            title: "Failed to update AI config",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          })
      });
    } else {
      createConfig.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Config created" });
          handleClose();
          queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
        },
        onError: (error) =>
          toast({
            title: "Failed to create AI config",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          })
      });
    }
  };

  const handleEdit = (c: AiModelConfig) => {
    setEditingId(c.id);
    const isCustom = !TASK_SCOPES.includes(c.taskScope);
    setIsCustomScope(isCustom);
    form.reset({
      taskScope: c.taskScope,
      provider: c.provider,
      modelName: c.modelName,
      isActive: c.isActive,
      priority: c.priority ?? 0,
      costPerInputToken: c.costPerInputToken ?? "",
      costPerOutputToken: c.costPerOutputToken ?? "",
      fallbackModelId: c.fallbackModelId ?? null,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if(confirm("Delete this config?")) {
      deleteConfig.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Config deleted" });
          queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
        },
        onError: (error) =>
          toast({
            title: "Failed to delete AI config",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          }),
      });
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setIsCustomScope(false);
    form.reset();
  };

  const getFallbackName = (id: number | undefined | null) => {
    if (!id) return null;
    const c = configs?.find(x => x.id === id);
    return c ? `${c.modelName} (${c.taskScope})` : `#${id}`;
  };

  const sortedConfigs = (configs ?? []).slice().sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="AI Config"
          subtitle="Configure AI model defaults per task type, manage cost caps, and set fallback behavior."
          variant="data"
        />

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) handleClose(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-config"><Plus className="mr-2 h-4 w-4"/>New Config</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Config" : "New Config"}</DialogTitle>
              <DialogDescription>
                Add or update the model routing settings used by the AI pipelines.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="taskScope" render={({field}) => (
                  <FormItem>
                    <FormLabel>Task Scope</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        if (v === "__custom") {
                          setIsCustomScope(true);
                          field.onChange("");
                        } else {
                          setIsCustomScope(false);
                          field.onChange(v);
                        }
                      }}
                      value={isCustomScope ? "__custom" : field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-config-scope">
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_SCOPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="__custom">Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                    {isCustomScope && (
                      <FormControl>
                        <Input
                          value={field.value}
                          placeholder="my_custom_scope"
                          data-testid="input-config-scope"
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}/>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="provider" render={({field}) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <FormControl><Input {...field} placeholder="openrouter" data-testid="input-config-provider"/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="priority" render={({field}) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} data-testid="input-config-priority"/></FormControl>
                      <FormDescription className="text-xs">Lower = tried first</FormDescription>
                    </FormItem>
                  )}/>
                </div>

                <FormField control={form.control} name="modelName" render={({field}) => (
                  <FormItem>
                    <FormLabel>Model Name</FormLabel>
                    <FormControl><Input {...field} placeholder="anthropic/claude-3-5-sonnet" data-testid="input-config-model"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>

                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="costPerInputToken" render={({field}) => (
                    <FormItem>
                      <FormLabel>Cost / Input Token ($)</FormLabel>
                      <FormControl><Input {...field} placeholder="0.000003" data-testid="input-cost-in"/></FormControl>
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="costPerOutputToken" render={({field}) => (
                    <FormItem>
                      <FormLabel>Cost / Output Token ($)</FormLabel>
                      <FormControl><Input {...field} placeholder="0.000015" data-testid="input-cost-out"/></FormControl>
                    </FormItem>
                  )}/>
                </div>

                <FormField control={form.control} name="fallbackModelId" render={({field}) => (
                  <FormItem>
                    <FormLabel>Fallback Model</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none" ? null : parseInt(v, 10))}
                      value={field.value ? String(field.value) : "__none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-fallback-model">
                          <SelectValue placeholder="No fallback" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">No fallback</SelectItem>
                        {(configs ?? [])
                          .filter(c => c.id !== editingId)
                          .map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.modelName} ({c.taskScope})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">Used when this model is inactive or fails.</FormDescription>
                  </FormItem>
                )}/>

                <FormField control={form.control} name="isActive" render={({field}) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="mb-0">Active</FormLabel>
                      <FormDescription className="text-xs">Inactive models are skipped; fallback is used instead.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-config-active"/>
                    </FormControl>
                  </FormItem>
                )}/>

                <Button type="submit" className="w-full" disabled={createConfig.isPending || updateConfig.isPending} data-testid="btn-submit-config">
                  {editingId ? "Update Config" : "Create Config"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : sortedConfigs.length === 0 ? (
        <div className="card-chunky flex flex-col items-center justify-center p-12 text-center">
          <Settings className="h-12 w-12 text-muted mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground">No AI configs yet</h3>
          <p className="text-sm text-muted mt-1">Create your first model config to enable AI pipelines.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedConfigs.map(c => {
            const fallbackName = getFallbackName(c.fallbackModelId);
            return (
              <ContentCard key={c.id} data-testid={`card-config-${c.id}`} className={cn("gamify-radius-chunky gamify-shadow", !c.isActive && "opacity-70")}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="shrink-0">{c.taskScope}</Badge>
                        {!c.isActive && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                        <span className="text-xs text-muted-foreground">Priority: {c.priority ?? 0}</span>
                      </div>
                      <div className="font-semibold truncate" title={c.modelName}>{c.modelName}</div>
                      <div className="text-sm text-muted-foreground">{c.provider}</div>
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} data-testid={`btn-edit-config-${c.id}`}><Pencil className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} data-testid={`btn-delete-config-${c.id}`}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                    </div>
                  </div>

                  {(c.costPerInputToken || c.costPerOutputToken) && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {c.costPerInputToken && <span>In: ${c.costPerInputToken}/tok</span>}
                      {c.costPerOutputToken && <span>Out: ${c.costPerOutputToken}/tok</span>}
                    </div>
                  )}

                  {fallbackName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      Fallback: <span className="font-medium">{fallbackName}</span>
                    </div>
                  )}
                </CardContent>
              </ContentCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
