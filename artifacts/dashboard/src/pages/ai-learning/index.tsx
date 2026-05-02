import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, RefreshCw, TrendingUp, Trophy, AlertCircle, CheckCircle, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VariantStat {
 id: number;
 variantType: string;
 variantId: number;
 taskScope: string;
 successes: number;
 failures: number;
 pending: number;
 totalCostUsd: string;
 avgCostPerApp: string;
 lastComputedAt: string | null;
 label?: string;
}

interface VariantComparison {
 id: number;
 taskScope: string;
 variantAId: number;
 variantAType: string;
 variantBId: number;
 variantBType: string;
 probabilityA: string;
 confidence: string;
 successRateA: string;
 successRateB: string;
 sampleSizeA: number;
 sampleSizeB: number;
 status: string;
 promotedAt: string | null;
 revertedAt: string | null;
}

interface LearningConfig {
 id: number;
 autoPromoteEnabled: boolean;
 confidenceThreshold: string;
 minSampleSize: number;
 minImprovementMargin: string;
 recomputeScheduleCron: string;
}

const API_BASE = "/api/ai-learning";

function statusVariant(
 status: string,
): "default" | "secondary" | "destructive" | "outline" {
 switch (status) {
 case "suggested":
 return "default";
 case "auto_promoted":
 return "default";
 case "reverted":
 return "destructive";
 case "stale":
 return "secondary";
 default:
 return "outline";
 }
}

function confidencePercent(value: string): string {
 const p = parseFloat(value);
 if (Number.isNaN(p)) return "0";
 return (p * 100).toFixed(1);
}

export default function AiLearningPage() {
 const queryClient = useQueryClient();
 const { toast } = useToast();
 const [configEditing, setConfigEditing] = useState(false);

 const { data: stats, isLoading: statsLoading } = useQuery<VariantStat[]>({
 queryKey: ["ai-learning-stats"],
 queryFn: () => fetch(`${API_BASE}/stats`).then((r) => r.json()),
 });

 const { data: comparisons } = useQuery<VariantComparison[]>({
 queryKey: ["ai-learning-comparisons"],
 queryFn: () => fetch(`${API_BASE}/comparisons`).then((r) => r.json()),
 });

 const { data: config } = useQuery<LearningConfig>({
 queryKey: ["ai-learning-config"],
 queryFn: () => fetch(`${API_BASE}/config`).then((r) => r.json()),
 });

 const recomputeMutation = useMutation({
 mutationFn: () =>
 fetch(`${API_BASE}/recompute`, { method: "POST" }).then((r) => r.json()),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["ai-learning-stats"] });
 queryClient.invalidateQueries({ queryKey: ["ai-learning-comparisons"] });
 toast({ title: "Recomputation complete" });
 },
 onError: (err) => {
 toast({
 title: "Recomputation failed",
 description: String(err),
 variant: "destructive",
 });
 },
 });

 const promoteMutation = useMutation({
 mutationFn: (id: number) =>
 fetch(`${API_BASE}/comparisons/${id}/promote`, { method: "POST" }).then(
 (r) => r.json(),
 ),
 onSuccess: () => {
 queryClient.invalidateQueries({
 queryKey: ["ai-learning-comparisons"],
 });
 queryClient.invalidateQueries({ queryKey: ["ai-learning-stats"] });
 toast({ title: "Variant promoted" });
 },
 onError: (err) => {
 toast({
 title: "Promotion failed",
 description: String(err),
 variant: "destructive",
 });
 },
 });

 const revertMutation = useMutation({
 mutationFn: (id: number) =>
 fetch(`${API_BASE}/comparisons/${id}/revert`, { method: "POST" }).then(
 (r) => r.json(),
 ),
 onSuccess: () => {
 queryClient.invalidateQueries({
 queryKey: ["ai-learning-comparisons"],
 });
 queryClient.invalidateQueries({ queryKey: ["ai-learning-stats"] });
 toast({ title: "Variant reverted" });
 },
 onError: (err) => {
 toast({
 title: "Revert failed",
 description: String(err),
 variant: "destructive",
 });
 },
 });

 const configMutation = useMutation({
 mutationFn: (body: Partial<LearningConfig>) =>
 fetch(`${API_BASE}/config`, {
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 }).then((r) => r.json()),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["ai-learning-config"] });
 toast({ title: "Configuration updated" });
 setConfigEditing(false);
 },
 onError: (err) => {
 toast({
 title: "Update failed",
 description: String(err),
 variant: "destructive",
 });
 },
 });

 const hasData = stats && stats.length > 0;
 const suggestedComparisons =
 comparisons?.filter((c) => c.status === "suggested") ?? [];
 const autoComparisons =
 comparisons?.filter((c) => c.status === "auto_promoted") ?? [];
 const totalApplications =
 stats?.reduce(
 (sum, s) => sum + s.successes + s.failures + s.pending,
 0,
 ) ?? 0;

 return (
 <div className="space-y-6">
 <PageHeader
 title="AI Learning"
 subtitle="Bayesian auto-optimizer that learns from feedback signals to improve prompt versions over time."
 variant="data"
 >
 <Button
 onClick={() => recomputeMutation.mutate()}
 disabled={recomputeMutation.isPending}
 >
 <RefreshCw
 className={cn(
 "h-4 w-4 mr-2",
 recomputeMutation.isPending && "animate-spin",
 )}
 />
 Recompute Now
 </Button>
 </PageHeader>

 {stats?.some((s) => s.lastComputedAt) && (
 <p className="text-xs text-muted-foreground">
 Last computed:{" "}
 {new Date(
 stats.find((s) => s.lastComputedAt)!.lastComputedAt!,
 ).toLocaleString()}
 </p>
 )}

 {!hasData && !statsLoading && (
  <div className="card-glass flex flex-col items-center justify-center py-12 text-center">
  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold mb-2">Not Enough Data</h3>
  <p className="text-muted-foreground max-w-md">
  Collect at least 10 applications with outcomes to start
  learning. Your application outcomes
  (accepted/rejected/offer) automatically feed the learning
  engine.
  </p>
  <p className="text-sm text-muted-foreground mt-2">
  Currently: {totalApplications} applications recorded
  </p>
  </div>
 )}

 {hasData && (
 <>
 <StaggerContainer className="grid gap-4 md:grid-cols-3">
  <div className="card-glass p-6">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
  <CardTitle className="text-sm font-medium">
  Total Applications
  </CardTitle>
  <TrendingUp className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
  <div className="text-2xl font-bold">{totalApplications}</div>
  <p className="text-xs text-muted-foreground">
  Across all variants
  </p>
  </CardContent>
  </div>
  <div className="card-glass p-6">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
  <CardTitle className="text-sm font-medium">
  Suggestions
  </CardTitle>
  <Trophy className="h-4 w-4 text-warning" />
  </CardHeader>
  <CardContent>
  <div className="text-2xl font-bold">
  {suggestedComparisons.length}
  </div>
  <p className="text-xs text-muted-foreground">
  Promotions awaiting review
  </p>
  </CardContent>
  </div>
  <div className="card-glass p-6">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
  <CardTitle className="text-sm font-medium">
  Auto Promotions
  </CardTitle>
  <CheckCircle className="h-4 w-4 text-success" />
  </CardHeader>
  <CardContent>
  <div className="text-2xl font-bold">
  {autoComparisons.length}
  </div>
  <p className="text-xs text-muted-foreground">
  System-promoted variants
  </p>
  </CardContent>
  </div>
 </StaggerContainer>

  <div className="card-glass p-6">
  <CardHeader>
  <CardTitle>Variant Leaderboard</CardTitle>
  <CardDescription>
  Performance metrics per prompt version and task scope
  </CardDescription>
  </CardHeader>
  <CardContent>
  <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Variant</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Task Scope</TableHead>
 <TableHead className="text-right">Success Rate</TableHead>
 <TableHead className="text-right">Sample Size</TableHead>
 <TableHead className="text-right">Cost/App</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {stats?.map((stat) => {
 const total =
 stat.successes + stat.failures + stat.pending;
 const rate =
 total > 0
 ? ((stat.successes / total) * 100).toFixed(1)
 : "0.0";
 return (
 <TableRow key={stat.id}>
 <TableCell className="font-medium">
 {stat.label ?? `#${stat.variantId}`}
 </TableCell>
 <TableCell>
 <Badge variant="outline">{stat.variantType}</Badge>
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">
 {stat.taskScope}
 </TableCell>
 <TableCell className="text-right">{rate}%</TableCell>
 <TableCell className="text-right">{total}</TableCell>
 <TableCell className="text-right">
 ${parseFloat(stat.avgCostPerApp || "0").toFixed(4)}
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </CardContent>
 </div>

 {suggestedComparisons.length > 0 && (
  <div className="card-glass p-6">
  <CardHeader>
  <CardTitle className="flex items-center gap-2">
  <Trophy className="h-5 w-5 text-warning" />
  Suggested Promotions
  </CardTitle>
  <CardDescription>
  Bayesian comparison results — promote the winning variant
  </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
  {suggestedComparisons.map((comp) => {
  const confPct = confidencePercent(comp.confidence);
  return (
  <div
  key={comp.id}
  className="panel-glass border-warning/30 rounded-2xl p-6"
  >
  <div className="flex items-center justify-between mb-4">
  <div>
  <h4 className="font-semibold">
  {comp.variantAType} #{comp.variantAId} vs #
  {comp.variantBId}
  </h4>
  <p className="text-xs text-muted-foreground">
  {comp.taskScope}
  </p>
  </div>
  <Badge variant={statusVariant(comp.status)}>
  {confPct}% confidence
  </Badge>
  </div>
  <div className="grid grid-cols-2 gap-4 mb-4">
  <div>
  <p className="text-xs text-muted-foreground">
  Winner (A)
  </p>
  <p className="text-lg font-bold">
  {confidencePercent(comp.successRateA)}%
  </p>
  <p className="text-xs text-muted-foreground">
  N={comp.sampleSizeA}
  </p>
  </div>
  <div>
  <p className="text-xs text-muted-foreground">
  Loser (B)
  </p>
  <p className="text-lg font-bold text-muted-foreground">
  {confidencePercent(comp.successRateB)}%
  </p>
  <p className="text-xs text-muted-foreground">
  N={comp.sampleSizeB}
  </p>
  </div>
  </div>
  <div className="w-full bg-muted rounded-full h-2 mb-4">
  <div
  className="bg-warning h-2 rounded-full transition-all"
  style={{ width: `${confPct}%` }}
  />
  </div>
  <Button
  variant="default"
  size="sm"
  onClick={() => promoteMutation.mutate(comp.id)}
  disabled={promoteMutation.isPending}
  >
  Promote Variant #{comp.variantAId}
  </Button>
  </div>
  );
  })}
  </CardContent>
  </div>
 )}

 {autoComparisons.length > 0 && (
  <div className="card-glass p-6">
  <CardHeader>
  <CardTitle className="flex items-center gap-2">
  <CheckCircle className="h-5 w-5 text-success" />
  Auto-Promoted
  </CardTitle>
  <CardDescription>
  System promoted — review and revert if needed
  </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
  {autoComparisons.map((comp) => {
  const confPct = confidencePercent(comp.confidence);
  return (
  <div
  key={comp.id}
  className="panel-glass border-success/30 rounded-2xl p-6"
  >
  <div className="flex items-center justify-between mb-4">
  <div>
  <h4 className="font-semibold">
  {comp.variantAType} #{comp.variantAId} vs #
  {comp.variantBId}
  </h4>
  <p className="text-xs text-muted-foreground">
  {comp.taskScope}
  </p>
  </div>
  <Badge variant="default" className="bg-success">
  Promoted
  </Badge>
  </div>
  <div className="grid grid-cols-2 gap-4 mb-4">
  <div>
  <p className="text-xs text-muted-foreground">
  Promoted (A)
  </p>
  <p className="text-lg font-bold text-success">
  {confidencePercent(comp.successRateA)}%
  </p>
  <p className="text-xs text-muted-foreground">
  N={comp.sampleSizeA}
  </p>
  </div>
  <div>
  <p className="text-xs text-muted-foreground">
  Replaced (B)
  </p>
  <p className="text-lg font-bold text-muted-foreground">
  {confidencePercent(comp.successRateB)}%
  </p>
  <p className="text-xs text-muted-foreground">
  N={comp.sampleSizeB}
  </p>
  </div>
  </div>
  <div className="w-full bg-muted rounded-full h-2 mb-4">
  <div
  className="bg-success h-2 rounded-full transition-all"
  style={{ width: `${confPct}%` }}
  />
  </div>
  {comp.promotedAt && (
  <p className="text-xs text-muted-foreground mb-4">
  Promoted: {new Date(comp.promotedAt).toLocaleString()}
  </p>
  )}
  <Button
  variant="default"
  size="sm"
  onClick={() => revertMutation.mutate(comp.id)}
  disabled={revertMutation.isPending}
  >
  <Undo2 className="h-4 w-4 mr-2" />
  Revert Promotion
  </Button>
  </div>
  );
  })}
  </CardContent>
  </div>
 )}

  <div className="card-glass p-6">
  <CardHeader>
  <CardTitle>Learning Configuration</CardTitle>
  <CardDescription>
  Thresholds and automation settings
  </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="auto-promote">Auto-Promote Enabled</Label>
 <Switch
 id="auto-promote"
 checked={config?.autoPromoteEnabled ?? false}
 onCheckedChange={(checked) =>
 configMutation.mutate({ autoPromoteEnabled: checked })
 }
 />
 </div>
 {configEditing ? (
 <div className="space-y-3">
 <div>
 <Label htmlFor="confidence-threshold">
 Confidence Threshold (0-1)
 </Label>
 <Input
 id="confidence-threshold"
 defaultValue={config?.confidenceThreshold ?? "0.95"}
 onBlur={(e) => {
 if (e.target.value) {
 configMutation.mutate({
 confidenceThreshold: e.target.value,
 });
 }
 setConfigEditing(false);
 }}
 />
 </div>
 <div>
 <Label htmlFor="min-sample">Minimum Sample Size</Label>
 <Input
 id="min-sample"
 type="number"
 defaultValue={config?.minSampleSize ?? 10}
 onBlur={(e) => {
 if (e.target.value) {
 configMutation.mutate({
 minSampleSize: parseInt(e.target.value, 10),
 });
 }
 setConfigEditing(false);
 }}
 />
 </div>
 <div>
 <Label htmlFor="min-improvement">
 Minimum Improvement Margin (0-1)
 </Label>
 <Input
 id="min-improvement"
 defaultValue={config?.minImprovementMargin ?? "0.05"}
 onBlur={(e) => {
 if (e.target.value) {
 configMutation.mutate({
 minImprovementMargin: e.target.value,
 });
 }
 setConfigEditing(false);
 }}
 />
 </div>
 </div>
 ) : (
 <Button
 variant="outline"
 onClick={() => setConfigEditing(true)}
 >
 Edit Parameters
 </Button>
 )}
 </CardContent>
 </div>
 </>
 )}
 </div>
 );
}
