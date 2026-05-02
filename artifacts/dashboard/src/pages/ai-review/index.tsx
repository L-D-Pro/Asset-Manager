import { useQueryClient } from "@tanstack/react-query";
import {
 getGetAiReviewOverviewQueryKey,
 useCreateAiPromptVersion,
 useGetAiReviewOverview,
} from "@workspace/api-client-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Brain, FlaskConical, History, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { useState } from "react";
import type React from "react";

const DEFAULT_PROMPT = {
 taskScope: "resume_tailoring",
 label: "",
 version: 1,
 systemPrompt: "",
 userPromptTemplate: "{{userPrompt}}",
 notes: "",
 isActive: false,
};

export default function AiReviewPage() {
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const [promptForm, setPromptForm] = useState(DEFAULT_PROMPT);
 const { data, isLoading } = useGetAiReviewOverview();

 const createPrompt = useCreateAiPromptVersion({
 mutation: {
 onSuccess: () => {
 toast({ title: "Prompt version saved" });
 setPromptForm(DEFAULT_PROMPT);
 queryClient.invalidateQueries({ queryKey: getGetAiReviewOverviewQueryKey() });
 },
 onError: (error) =>
 toast({
 title: "Failed to save prompt version",
 description: getErrorMessage(error, "Please check the prompt fields."),
 variant: "destructive",
 }),
 },
 });

 const stats = data?.stats;

 return (
 <div className="space-y-8">
 <PageHeader
 title="AI Review"
 subtitle="Version prompts, inspect AI runs, and curate supervised learning signals without fine-tuning prematurely."
 variant="data"
 />

 <div className="grid gap-4 md:grid-cols-4">
 <Metric title="Recent AI Runs" value={stats?.recentAiEvents ?? 0} icon={<History className="h-4 w-4" />} />
 <Metric title="Evaluations" value={stats?.evaluations ?? 0} icon={<ShieldCheck className="h-4 w-4" />} />
 <Metric title="Active Prompts" value={stats?.activePromptVersions ?? 0} icon={<Brain className="h-4 w-4" />} />
 <Metric title="Training Examples" value={stats?.trainingExamples ?? 0} icon={<FlaskConical className="h-4 w-4" />} />
 </div>

  <ContentCard className="rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)]">
 <CardHeader>
 <CardTitle>Create Prompt Version</CardTitle>
 <CardDescription>
 Active versions override the built-in prompt for a task. Use {"{{userPrompt}}"} inside the template to preserve runtime context.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-3">
 <div className="space-y-1.5">
 <label className="text-sm font-medium">Task Scope</label>
 <Input
 value={promptForm.taskScope}
 onChange={(event) => setPromptForm({ ...promptForm, taskScope: event.target.value })}
 placeholder="e.g., resume_tailoring, cover_letter"
 />
 <p className="text-xs text-muted-foreground">The AI pipeline task this prompt overrides</p>
 </div>
 <div className="space-y-1.5">
 <label className="text-sm font-medium">Label</label>
 <Input
 value={promptForm.label}
 onChange={(event) => setPromptForm({ ...promptForm, label: event.target.value })}
 placeholder="e.g., baseline-v1, improved-v2"
 />
 <p className="text-xs text-muted-foreground">Human-readable name for this version</p>
 </div>
 <div className="space-y-1.5">
 <label className="text-sm font-medium">Version Number</label>
 <Input
 type="number"
 value={promptForm.version}
 onChange={(event) => setPromptForm({ ...promptForm, version: Number(event.target.value) })}
 placeholder="1, 2, 3..."
 />
 <p className="text-xs text-muted-foreground">Numeric version within this task scope</p>
 </div>
 </div>
 <div className="space-y-1.5">
 <label className="text-sm font-medium">System Prompt</label>
 <Textarea
 value={promptForm.systemPrompt}
 onChange={(event) => setPromptForm({ ...promptForm, systemPrompt: event.target.value })}
 placeholder="Instructions for the AI (e.g., 'You are a professional resume writer...')"
 className="min-h-28"
 />
 <p className="text-xs text-muted-foreground">The system message sent to the AI model</p>
 </div>
 <div className="space-y-1.5">
 <label className="text-sm font-medium">User Prompt Template</label>
 <Textarea
 value={promptForm.userPromptTemplate}
 onChange={(event) => setPromptForm({ ...promptForm, userPromptTemplate: event.target.value })}
 placeholder="Template with {{userPrompt}} placeholder for runtime context"
 className="min-h-20"
 />
 <p className="text-xs text-muted-foreground">Use {'{{userPrompt}}'} where runtime content should be inserted</p>
 </div>
 <div className="flex items-center justify-between gap-3 pt-2">
 <label className="flex items-center gap-2 text-sm">
 <input
 type="checkbox"
 checked={promptForm.isActive}
 onChange={(event) => setPromptForm({ ...promptForm, isActive: event.target.checked })}
 />
 <span className="font-medium">Make active for this task</span>
 </label>
 <Button
 onClick={() => createPrompt.mutate({ data: promptForm })}
 disabled={!promptForm.label || !promptForm.systemPrompt || createPrompt.isPending}
 >
 {createPrompt.isPending ? "Saving..." : "Save Prompt Version"}
 </Button>
 </div>
 </CardContent>
 </ContentCard>

 <div className="grid gap-4 lg:grid-cols-2">
  <ContentCard className="rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)]">
  <CardHeader>
  <CardTitle>Recent AI Events</CardTitle>
 <CardDescription>Model, cost, prompt version, and fallback metadata are logged in event metadata.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
 {data?.recentAiEvents.map((event) => (
  <div key={event.id} className="card-glass p-3 text-sm">
 <div className="flex items-center justify-between gap-3">
 <span className="font-medium">{metadataValue(event.metadata, "taskType") ?? event.nextState}</span>
 <Badge variant={event.eventType === "ai_call_failed" ? "destructive" : "secondary"}>
 {event.eventType}
 </Badge>
 </div>
 <p className="mt-1 text-muted-foreground">
 {metadataValue(event.metadata, "modelName") ?? "No model"} - prompt #{metadataValue(event.metadata, "promptVersionId") ?? "built-in"}
 </p>
 </div>
 ))}
 </CardContent>
 </ContentCard>

  <ContentCard className="rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)]">
  <CardHeader>
  <CardTitle>Prompt Versions</CardTitle>
 <CardDescription>Keep old versions immutable and activate only the prompt you want production calls to use.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {data?.promptVersions.map((prompt) => (
  <div key={prompt.id} className="card-glass p-3 text-sm">
 <div className="flex items-center justify-between gap-3">
 <span className="font-medium">{prompt.label}</span>
 <Badge variant={prompt.isActive ? "default" : "outline"}>{prompt.taskScope}</Badge>
 </div>
 <p className="mt-1 text-muted-foreground">
 v{prompt.version} {prompt.isActive ? "- active" : "- inactive"}
 </p>
 </div>
 ))}
 </CardContent>
 </ContentCard>
 </div>
 </div>
 );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
 return (
  <ContentCard className="shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)]">
  <CardContent className="p-4">
 <div className="flex items-center justify-between text-sm text-muted-foreground">
 <span>{title}</span>
 {icon}
 </div>
 <div className="mt-2 text-2xl font-bold">{value}</div>
 </CardContent>
 </ContentCard>
 );
}

function metadataValue(metadata: unknown, key: string): string | number | null {
 if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
 return null;
 }
 const value = (metadata as Record<string, unknown>)[key];
 return typeof value === "string" || typeof value === "number" ? value : null;
}
