import { useListAiModelConfigs, useCreateAiModelConfig, useUpdateAiModelConfig, useDeleteAiModelConfig, getListAiModelConfigsQueryKey, type AiModelConfig } from "@workspace/api-client-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { Settings, Plus, Pencil, Trash2, ArrowRight, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";

interface ScopeHealthStatus {
 scope: string;
 hasActiveConfig: boolean;
 activeModelName: string | null;
 requiresFallback: boolean;
 fallbackWired: boolean;
 fallbackModelName: string | null;
 healthy: boolean;
}

interface ModelConfigHealthReport {
 healthy: boolean;
 checkedAt: string;
 scopes: ScopeHealthStatus[];
 unhealthyScopes: string[];
}

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

const RECOMMENDED_FALLBACK_MODELS = [
 { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro", note: "1M ctx, structured, $0.44/M in, $0.87/M out" },
 { id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", note: "2M ctx, structured, $0.20/M in, $0.50/M out" },
 { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", note: "1M ctx, structured, $0.14/M in, $0.28/M out" },
 { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", note: "1M ctx, verified fallback candidate, $0.10/M in, $0.40/M out" },
 { id: "qwen/qwen3.6-flash", label: "Qwen3.6 Flash", note: "1M ctx, structured, $0.25/M in" },
 { id: "qwen/qwen3.5-plus-20260420", label: "Qwen3.5 Plus", note: "1M ctx, structured, $0.40/M in" },
 { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", note: "1M ctx, structured, $0.40/M in" },
 { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", note: "1M ctx, structured, $0.15/M in, $0.60/M out" },
 { id: "qwen/qwen-plus-2025-07-28:thinking", label: "Qwen Plus Thinking", note: "1M ctx, structured, $0.26/M in, $0.78/M out" },
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
 fallbackChoice: z.string().optional(),
 secondFallbackChoice: z.string().optional(),
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

 const [healthReport, setHealthReport] = useState<ModelConfigHealthReport | null>(null);
 const [isReseeding, setIsReseeding] = useState(false);

 const fetchHealth = async () => {
   try {
     const res = await fetch("/api/admin/health/model-configs", { credentials: "include" });
     if (res.ok || res.status === 207) {
       setHealthReport((await res.json()) as ModelConfigHealthReport);
     }
   } catch {
     // Non-critical — silently ignore
   }
 };

 useEffect(() => {
   void fetchHealth();
 }, [configs]);

 const handleReseed = async () => {
   setIsReseeding(true);
   try {
     const res = await fetch("/api/admin/health/model-configs/reseed", {
       method: "POST",
       credentials: "include",
     });
     if (res.ok || res.status === 207) {
       const report = (await res.json()) as ModelConfigHealthReport;
       setHealthReport(report);
       queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
       if (report.healthy) {
         toast({ title: "Configs repaired", description: "All required model configs are now active." });
       } else {
         toast({
           title: "Partially repaired",
           description: `Still unhealthy: ${report.unhealthyScopes.join(", ")}`,
           variant: "destructive",
         });
       }
     } else {
       toast({ title: "Re-seed failed", description: "Server returned an error.", variant: "destructive" });
     }
   } catch {
     toast({ title: "Re-seed failed", description: "Could not reach the server.", variant: "destructive" });
   } finally {
     setIsReseeding(false);
   }
 };

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
 fallbackChoice: "__none",
 secondFallbackChoice: "__none",
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

 const resolveFallbackChoice = async (choice: string | undefined, data: FormValues, priorityOffset: number): Promise<number | undefined> => {
 if (!choice || choice === "__none") return undefined;
 if (choice.startsWith("config:")) return Number(choice.slice("config:".length));
 const modelName = choice.startsWith("model:") ? choice.slice("model:".length).trim() : choice.trim();
 if (!modelName) return undefined;
 if (modelName === data.modelName.trim()) {
  throw new Error("Fallback model must be different from the primary model.");
 }
 const existing = configs?.find((config) => config.modelName === modelName && config.taskScope === data.taskScope);
 if (existing && existing.id !== editingId) return existing.id;
 const fallback = await createConfig.mutateAsync({
 data: {
 taskScope: data.taskScope,
 provider: data.provider,
 modelName,
 isActive: true,
 priority: data.priority + priorityOffset,
 },
 });
 return fallback.id;
 };

 const onSubmit = async (data: FormValues) => {
 try {
 const secondFallbackModelId = await resolveFallbackChoice(data.secondFallbackChoice, data, 2);
 const fallbackModelId = await resolveFallbackChoice(data.fallbackChoice, data, 1);
 if (fallbackModelId && secondFallbackModelId && fallbackModelId === secondFallbackModelId) {
 throw new Error("Fallback 1 and fallback 2 must be different configs.");
 }
 if (fallbackModelId && fallbackModelId !== editingId) {
 await updateConfig.mutateAsync({
 id: fallbackModelId,
 data: { fallbackModelId: secondFallbackModelId ?? null },
 });
 }
 const payload = {
 ...buildPayload(data),
 fallbackModelId,
 };
 if (editingId) {
 await updateConfig.mutateAsync({ id: editingId, data: payload });
 toast({ title: "Config updated" });
 } else {
 await createConfig.mutateAsync({ data: payload });
 toast({ title: "Config created" });
 }
 handleClose();
 queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
 } catch (error) {
 toast({
 title: editingId ? "Failed to update AI config" : "Failed to create AI config",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
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
 fallbackChoice: c.fallbackModelId ? `config:${c.fallbackModelId}` : "__none",
 secondFallbackChoice: configs?.find((config) => config.id === c.fallbackModelId)?.fallbackModelId
 ? `config:${configs.find((config) => config.id === c.fallbackModelId)?.fallbackModelId}`
 : "__none",
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
 const fallbackCandidates = (configs ?? []).filter((config) => config.id !== editingId);
 const firstFallbackChoice = form.watch("fallbackChoice");
 const getFallbackChain = (config: AiModelConfig) => {
 const first = configs?.find((item) => item.id === config.fallbackModelId);
 const second = first ? configs?.find((item) => item.id === first.fallbackModelId) : null;
 return {
 firstName: first ? `${first.modelName} (${first.taskScope})` : getFallbackName(config.fallbackModelId),
 secondName: second ? `${second.modelName} (${second.taskScope})` : null,
 };
 };

 return (
 <div>
 {healthReport && !healthReport.healthy && (
   <div data-testid="model-config-health-banner">
     <div>
       <AlertTriangle />
       <div>
         <div>
           <p>AI model config problem detected</p>
           <Button
             data-testid="btn-reseed-configs"
             variant="outline"
             size="sm"
             onClick={() => void handleReseed()}
             disabled={isReseeding}
           >
             <RefreshCw />
             {isReseeding ? "Repairing…" : "Re-seed defaults"}
           </Button>
         </div>
         <p>
           The following scopes are missing an active model or a required fallback. AI generation will fail for these scopes until the configs are fixed.
         </p>
         <div>
           {healthReport.scopes.filter((s) => !s.healthy).map((s) => (
             <div key={s.scope}>
               <span>{s.scope}</span>
               {!s.hasActiveConfig && (
                 <span>— no active model</span>
               )}
               {s.hasActiveConfig && s.requiresFallback && !s.fallbackWired && (
                 <span>— fallback not wired</span>
               )}
             </div>
           ))}
         </div>
       </div>
     </div>
   </div>
 )}
 {healthReport?.healthy && (
   <div data-testid="model-config-health-ok">
     <CheckCircle2 />
     All required model configs are active and properly wired.
   </div>
 )}
 <div>
 <div>
 <PageHeader
 title="AI Config"
 subtitle="Configure AI model defaults per task type, manage cost caps, and set fallback behavior."
 variant="data"
 />
 <p>
 Tune model + prompt + role + best practices for one task at once in the{" "}
 <Link to="/pipeline-diagram">
 AI Pipeline Hub
 </Link>
 .
 </p>
 </div>

 <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) handleClose(); else setIsDialogOpen(true); }}>
 <DialogTrigger asChild>
 <Button data-testid="btn-add-config"><Plus/>New Config</Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{editingId ? "Edit Config" : "New Config"}</DialogTitle>
 <DialogDescription>
 Add or update the model routing settings used by the AI pipelines.
 </DialogDescription>
 </DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)}>
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

 <div>
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
 <FormDescription>Lower = tried first</FormDescription>
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
 <div>
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

 <FormField control={form.control} name="fallbackChoice" render={({field}) => (
 <FormItem>
 <FormLabel>Fallback Model 1</FormLabel>
 <Select
 onValueChange={field.onChange}
 value={field.value || "__none"}
 >
 <FormControl>
 <SelectTrigger data-testid="select-fallback-model">
 <SelectValue placeholder="No fallback" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="__none">No fallback</SelectItem>
 {fallbackCandidates.length === 0 && (
 <SelectItem value="__empty" disabled>No saved fallback configs yet</SelectItem>
 )}
 {fallbackCandidates.map(c => (
 <SelectItem key={c.id} value={`config:${c.id}`}>
 {c.modelName} ({c.taskScope})
 </SelectItem>
 ))}
 {RECOMMENDED_FALLBACK_MODELS.map((model) => (
 <SelectItem key={model.id} value={`model:${model.id}`}>
 {model.label} - {model.id}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormDescription>Used first if the primary model fails. Recommended models are created as configs when saved.</FormDescription>
 </FormItem>
 )}/>

 <FormField control={form.control} name="secondFallbackChoice" render={({field}) => (
 <FormItem>
 <FormLabel>Fallback Model 2</FormLabel>
 <Select
 onValueChange={field.onChange}
 value={field.value || "__none"}
 disabled={!firstFallbackChoice || firstFallbackChoice === "__none"}
 >
 <FormControl>
 <SelectTrigger data-testid="select-second-fallback-model">
 <SelectValue placeholder="No second fallback" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="__none">No second fallback</SelectItem>
 {fallbackCandidates.map(c => (
 <SelectItem key={c.id} value={`config:${c.id}`}>
 {c.modelName} ({c.taskScope})
 </SelectItem>
 ))}
 {RECOMMENDED_FALLBACK_MODELS.map((model) => (
 <SelectItem key={model.id} value={`model:${model.id}`}>
 {model.label} - {model.id}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormDescription>
 Optional. If fallback 1 fails, routing follows this third model.
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}/>

 <div>
 <p>Recommended low-cost long-context fallbacks</p>
 <p>Best for strict resume JSON because they support response format and structured outputs.</p>
 <div>
 {RECOMMENDED_FALLBACK_MODELS.slice(0, 5).map((model) => (
 <span key={model.id}>{model.label}: {model.note}</span>
 ))}
 </div>
 </div>

 <FormField control={form.control} name="isActive" render={({field}) => (
 <FormItem>
 <div>
 <FormLabel>Active</FormLabel>
 <FormDescription>Inactive models are skipped; fallback is used instead.</FormDescription>
 </div>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-config-active"/>
 </FormControl>
 </FormItem>
 )}/>

 <Button type="submit" disabled={createConfig.isPending || updateConfig.isPending} data-testid="btn-submit-config">
 {editingId ? "Update Config" : "Create Config"}
 </Button>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </div>

 {isLoading ? <Skeleton /> : sortedConfigs.length === 0 ? (
  <div>
  <Settings />
  <h3>No AI configs yet</h3>
  <p>Create your first model config to enable AI pipelines.</p>
  </div>
 ) : (
 <div>
 {sortedConfigs.map(c => {
 const fallbackChain = getFallbackChain(c);
 return (
  <div key={c.id} data-testid={`card-config-${c.id}`}>
  <div>
 <div>
 <div>
 <div>
 <Badge>{c.taskScope}</Badge>
 {!c.isActive && <Badge variant="outline">Inactive</Badge>}
 <span>Priority: {c.priority ?? 0}</span>
 </div>
 <div title={c.modelName}>{c.modelName}</div>
 <div>{c.provider}</div>
 </div>
 <div>
 <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} data-testid={`btn-edit-config-${c.id}`}><Pencil/></Button>
 <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} data-testid={`btn-delete-config-${c.id}`}><Trash2/></Button>
 </div>
 </div>

 {(c.costPerInputToken || c.costPerOutputToken) && (
 <div>
 {c.costPerInputToken && <span>In: ${c.costPerInputToken}/tok</span>}
 {c.costPerOutputToken && <span>Out: ${c.costPerOutputToken}/tok</span>}
 </div>
 )}

 {fallbackChain.firstName && (
 <div>
 <ArrowRight />
 Fallback: <span>{fallbackChain.firstName}</span>
 {fallbackChain.secondName && (
 <>
 <ArrowRight />
 <span>{fallbackChain.secondName}</span>
 </>
 )}
 </div>
 )}
  </div>
  </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
