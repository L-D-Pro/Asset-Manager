import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, RefreshCw, TrendingUp, Trophy, AlertCircle, CheckCircle, Undo2, HeartPulse, Users, Activity } from "lucide-react";
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

interface OutcomeStat {
 taskScope: string;
 totalEvaluations: number;
 approved: number;
 rejected: number;
 pending: number;
 approvalRate: number;
 avgTruthfulnessScore: number | null;
 avgRelevanceScore: number | null;
 activeTrainingExamples: number;
}

interface LearningConfig {
 id: number;
 autoPromoteEnabled: boolean;
 confidenceThreshold: string;
 minSampleSize: number;
 minImprovementMargin: string;
 recomputeScheduleCron: string;
}

interface AiLearningHealth {
 autoPromoteEnabled: boolean;
 confidenceThreshold: string;
 minSampleSize: number;
 unprocessedSignalCount: number;
 totalVariantStats: number;
 totalComparisons: number;
 suggestedComparisons: number;
 autoPromotedComparisons: number;
 overallStatus: "healthy" | "warning" | "degraded";
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

  const { data: outcomeStats } = useQuery<OutcomeStat[]>({
  queryKey: ["ai-learning-outcome-stats"],
  queryFn: () => fetch(`${API_BASE}/outcome-stats`).then((r) => r.json()),
  });

  const { data: promptVersions } = useQuery<any[]>({
  queryKey: ["ai-prompt-versions"],
  queryFn: () => fetch("/api/ai-prompt-versions").then((r) => r.json()),
  });

  const { data: health } = useQuery<AiLearningHealth>({
  queryKey: ["ai-learning-health"],
  queryFn: () => fetch(`${API_BASE}/health`).then((r) => r.json()),
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
 const hasOutcomeData = outcomeStats && outcomeStats.length > 0;
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

 {/* Outcome Analytics Section */}
 <ContentCard>
 <div className="flex items-center gap-2 mb-4">
 <TrendingUp className="h-5 w-5 text-primary" />
 <SectionHeader
 title="Outcome Analytics"
 description="Approval rates, quality scores, and active training examples per task scope."
 />
 </div>
 {hasOutcomeData ? (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Task Scope</TableHead>
 <TableHead className="text-right">Evaluations</TableHead>
 <TableHead className="text-right">Approval Rate</TableHead>
 <TableHead className="text-right">Approved</TableHead>
 <TableHead className="text-right">Rejected</TableHead>
 <TableHead className="text-right">Avg Truthfulness</TableHead>
 <TableHead className="text-right">Avg Relevance</TableHead>
 <TableHead className="text-right">Training Examples</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {outcomeStats!.map((stat) => (
 <TableRow key={stat.taskScope}>
 <TableCell className="font-mono text-sm">{stat.taskScope}</TableCell>
 <TableCell className="text-right">{stat.totalEvaluations}</TableCell>
 <TableCell className="text-right">
 <span
 className={cn(
 "font-semibold",
 stat.approvalRate >= 70 ? "text-green-600" : stat.approvalRate >= 40 ? "text-yellow-600" : "text-red-600",
 )}
 >
 {stat.approvalRate}%
 </span>
 </TableCell>
 <TableCell className="text-right text-green-600">{stat.approved}</TableCell>
 <TableCell className="text-right text-red-600">{stat.rejected}</TableCell>
 <TableCell className="text-right">{stat.avgTruthfulnessScore ?? "—"}</TableCell>
 <TableCell className="text-right">{stat.avgRelevanceScore ?? "—"}</TableCell>
 <TableCell className="text-right">
 <Badge variant={stat.activeTrainingExamples > 0 ? "default" : "secondary"}>
 {stat.activeTrainingExamples}
 </Badge>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 ) : (
 <div className="py-8 text-center text-muted-foreground">
 <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
 <p className="text-sm">No evaluations recorded yet. Approve or reject resume and cover letter versions to start building outcome data.</p>
 </div>
  )}
   </ContentCard>

   {/* Health Overview */}
   {health && (
    <div className="card-glass p-6">
      <CardHeader className="px-0 pb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <CardTitle className="text-lg font-semibold">Health Overview</CardTitle>
        </div>
        <CardDescription>Loop health check and system status.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={
            health.overallStatus === "healthy" ? "default" :
            health.overallStatus === "warning" ? "secondary" : "destructive"
          } className="capitalize">
            {health.overallStatus}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {health.overallStatus === "healthy"
              ? "All systems operating normally"
              : health.overallStatus === "warning"
              ? "Low data volume — collect more signals"
              : "High backlog — run recompute"}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card/50 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Unprocessed</p>
            <div className="text-2xl font-bold">{health.unprocessedSignalCount}</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Variant Stats</p>
            <div className="text-2xl font-bold">{health.totalVariantStats}</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Comparisons</p>
            <div className="text-2xl font-bold">{health.totalComparisons}</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Suggested</p>
            <div className="text-2xl font-bold">{health.suggestedComparisons}</div>
          </div>
        </div>
      </CardContent>
    </div>
  )}

   {/* Loop Status Section */}
  <div className="card-glass p-6">
  <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-0 pb-4">
  <HeartPulse className="h-5 w-5 text-primary" />
  <div>
  <CardTitle className="text-lg font-semibold">Loop Status</CardTitle>
  <CardDescription>
  Feedback signal processing health and data distribution.
  </CardDescription>
  </div>
  </CardHeader>
  <CardContent className="px-0 space-y-6">
  <div className="grid gap-4 md:grid-cols-3">
  <div className="rounded-lg border bg-card/50 p-4">
  <p className="text-sm font-medium text-muted-foreground mb-1">
  Unprocessed Signals
  </p>
  <div className="text-2xl font-bold text-yellow-600">
  {stats?.reduce((sum, s) => sum + s.pending, 0) ?? 0}
  </div>
  <p className="text-xs text-muted-foreground mt-1">
  Waiting for recompute
  </p>
  </div>
  <div className="rounded-lg border bg-card/50 p-4">
  <p className="text-sm font-medium text-muted-foreground mb-1">
  Processed Signals
  </p>
  <div className="text-2xl font-bold text-green-600">
  {stats?.reduce((sum, s) => sum + s.successes + s.failures, 0) ?? 0}
  </div>
  <p className="text-xs text-muted-foreground mt-1">
  Successfully analyzed
  </p>
  </div>
  <div className="rounded-lg border bg-card/50 p-4">
  <p className="text-sm font-medium text-muted-foreground mb-1">
  Total Signals
  </p>
  <div className="text-2xl font-bold">
  {stats?.reduce((sum, s) => sum + s.successes + s.failures + s.pending, 0) ?? 0}
  </div>
  <p className="text-xs text-muted-foreground mt-1">
  All feedback received
  </p>
  </div>
  </div>

  <div className="space-y-4">
  <div className="flex items-center justify-between">
  <h4 className="text-sm font-semibold">Variant Breakdown</h4>
  {stats?.some((s) => s.lastComputedAt) && (
  <span className="text-xs text-muted-foreground">
  Last recompute:{" "}
  {new Date(
  Math.max(...stats.filter(s => s.lastComputedAt).map(s => new Date(s.lastComputedAt!).getTime()))
  ).toLocaleString()}
  </span>
  )}
  </div>
  <Table>
  <TableHeader>
  <TableRow>
  <TableHead>Type</TableHead>
  <TableHead className="text-right">Successes</TableHead>
  <TableHead className="text-right">Failures</TableHead>
  <TableHead className="text-right">Pending</TableHead>
  <TableHead className="text-right">Total Sample</TableHead>
  </TableRow>
  </TableHeader>
  <TableBody>
  {["prompt", "model"].map((type) => {
  const typeStats = stats?.filter(s => s.variantType === type) ?? [];
  const successes = typeStats.reduce((sum, s) => sum + s.successes, 0);
  const failures = typeStats.reduce((sum, s) => sum + s.failures, 0);
  const pending = typeStats.reduce((sum, s) => sum + s.pending, 0);
  const total = successes + failures;

  if (typeStats.length === 0) {
  return (
  <TableRow key={type}>
  <TableCell className="font-medium capitalize">{type}</TableCell>
  <TableCell colSpan={4} className="text-right text-muted-foreground italic">No data</TableCell>
  </TableRow>
  );
  }

  return (
  <TableRow key={type}>
  <TableCell className="font-medium capitalize">{type}</TableCell>
  <TableCell className="text-right">{successes}</TableCell>
  <TableCell className="text-right">{failures}</TableCell>
  <TableCell className="text-right">{pending}</TableCell>
  <TableCell className="text-right font-bold">{total}</TableCell>
  </TableRow>
  );
  })}
  </TableBody>
  </Table>

  {config && (
  (() => {
  const promptTotal = stats?.filter(s => s.variantType === "prompt").reduce((sum, s) => sum + s.successes + s.failures, 0) ?? 0;
  const modelTotal = stats?.filter(s => s.variantType === "model").reduce((sum, s) => sum + s.successes + s.failures, 0) ?? 0;
  
  if (promptTotal < config.minSampleSize && modelTotal < config.minSampleSize) {
  return (
  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
  <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
  <div>
  <p className="text-sm font-medium text-yellow-800">Waiting for more data</p>
  <p className="text-xs text-yellow-700">
  Current samples (Prompt: {promptTotal}, Model: {modelTotal}) are below the minimum threshold of {config.minSampleSize}. Suggestions will become more accurate as more signals are processed.
  </p>
  </div>
  </div>
  );
  }
  return null;
  })()
  )}
  </div>
  </CardContent>
  </div>

  {/* Agent Roles Section */}
  <ContentCard>
  <div className="flex items-center gap-2 mb-4">
  <Users className="h-5 w-5 text-primary" />
  <SectionHeader
  title="Agent Roles"
  description="Agent role definitions with personality, goals, and skill tags. Edit role fields in the AI Pipeline Hub → click a task → Role tab."
  />
  </div>
  <p className="mb-4 text-sm text-muted-foreground">
  Role personality, goals, and skill tags are now prepended to the system prompt at AI call time. Edit them in the{" "}
  <Link to="/pipeline-diagram" className="text-primary underline underline-offset-2">
  AI Pipeline Hub
  </Link>{" "}
  Role tab.
  </p>
  {promptVersions?.some((pv) => pv.roleLabel) ? (
  <div className="grid gap-6 md:grid-cols-2">
  {promptVersions
  .filter((pv: any) => pv.roleLabel)
  .map((pv: any) => (
  <div key={pv.id} className="card-glass rounded-xl p-5 space-y-3">
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
  <h3 className="font-semibold text-base">{pv.roleLabel}</h3>
  <Badge variant="outline" className="text-xs">{pv.taskScope}</Badge>
  </div>
  <Badge variant={pv.isActive ? "default" : "secondary"} className="text-xs">
  {pv.isActive ? "Active" : "Inactive"} v{pv.version}
  </Badge>
  </div>
  {pv.personality && (
  <div>
  <p className="text-xs font-medium text-muted-foreground mb-1">Personality</p>
  <p className="text-sm text-muted-foreground line-clamp-3">{pv.personality}</p>
  </div>
  )}
  {pv.goals && (
  <div>
  <p className="text-xs font-medium text-muted-foreground mb-1">Goals</p>
  <p className="text-sm text-muted-foreground line-clamp-3">{pv.goals}</p>
  </div>
  )}
  {pv.skillTags?.length > 0 && (
  <div>
  <p className="text-xs font-medium text-muted-foreground mb-1">Skill Tags</p>
  <div className="flex flex-wrap gap-1.5">
  {pv.skillTags.map((tag: string) => (
  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
  ))}
  </div>
  </div>
  )}
  </div>
  ))}
  </div>
  ) : (
  <div className="py-8 text-center text-muted-foreground">
  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
  <p className="text-sm">Agent roles will appear here once prompt versions are seeded. Run the DB migration to populate role definitions.</p>
  </div>
  )}
  </ContentCard>

  </div>
 );
}
