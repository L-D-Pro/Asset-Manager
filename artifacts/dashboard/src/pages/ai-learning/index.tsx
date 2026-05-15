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
 <div>
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
 />
 Recompute Now
 </Button>
 </PageHeader>

 {stats?.some((s) => s.lastComputedAt) && (
 <p>
 Last computed:{" "}
 {new Date(
 stats.find((s) => s.lastComputedAt)!.lastComputedAt!,
 ).toLocaleString()}
 </p>
 )}

 {!hasData && !statsLoading && (
  <div>
  <AlertCircle />
  <h3>Not Enough Data</h3>
  <p>
  Collect at least 10 applications with outcomes to start
  learning. Your application outcomes
  (accepted/rejected/offer) automatically feed the learning
  engine.
  </p>
  <p>
  Currently: {totalApplications} applications recorded
  </p>
  </div>
 )}

 {hasData && (
 <>
 <StaggerContainer>
  <div>
  <CardHeader>
  <CardTitle>
  Total Applications
  </CardTitle>
  <TrendingUp />
  </CardHeader>
  <CardContent>
  <div>{totalApplications}</div>
  <p>
  Across all variants
  </p>
  </CardContent>
  </div>
  <div>
  <CardHeader>
  <CardTitle>
  Suggestions
  </CardTitle>
  <Trophy />
  </CardHeader>
  <CardContent>
  <div>
  {suggestedComparisons.length}
  </div>
  <p>
  Promotions awaiting review
  </p>
  </CardContent>
  </div>
  <div>
  <CardHeader>
  <CardTitle>
  Auto Promotions
  </CardTitle>
  <CheckCircle />
  </CardHeader>
  <CardContent>
  <div>
  {autoComparisons.length}
  </div>
  <p>
  System-promoted variants
  </p>
  </CardContent>
  </div>
 </StaggerContainer>

  <div>
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
 <TableHead>Success Rate</TableHead>
 <TableHead>Sample Size</TableHead>
 <TableHead>Cost/App</TableHead>
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
 <TableCell>
 {stat.label ?? `#${stat.variantId}`}
 </TableCell>
 <TableCell>
 <Badge variant="outline">{stat.variantType}</Badge>
 </TableCell>
 <TableCell>
 {stat.taskScope}
 </TableCell>
 <TableCell>{rate}%</TableCell>
 <TableCell>{total}</TableCell>
 <TableCell>
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
  <div>
  <CardHeader>
  <CardTitle>
  <Trophy />
  Suggested Promotions
  </CardTitle>
  <CardDescription>
  Bayesian comparison results — promote the winning variant
  </CardDescription>
  </CardHeader>
  <CardContent>
  {suggestedComparisons.map((comp) => {
  const confPct = confidencePercent(comp.confidence);
  return (
  <div
  key={comp.id}
  >
  <div>
  <div>
  <h4>
  {comp.variantAType} #{comp.variantAId} vs #
  {comp.variantBId}
  </h4>
  <p>
  {comp.taskScope}
  </p>
  </div>
  <Badge variant={statusVariant(comp.status)}>
  {confPct}% confidence
  </Badge>
  </div>
  <div>
  <div>
  <p>
  Winner (A)
  </p>
  <p>
  {confidencePercent(comp.successRateA)}%
  </p>
  <p>
  N={comp.sampleSizeA}
  </p>
  </div>
  <div>
  <p>
  Loser (B)
  </p>
  <p>
  {confidencePercent(comp.successRateB)}%
  </p>
  <p>
  N={comp.sampleSizeB}
  </p>
  </div>
  </div>
  <div>
  <div
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
  <div>
  <CardHeader>
  <CardTitle>
  <CheckCircle />
  Auto-Promoted
  </CardTitle>
  <CardDescription>
  System promoted — review and revert if needed
  </CardDescription>
  </CardHeader>
  <CardContent>
  {autoComparisons.map((comp) => {
  const confPct = confidencePercent(comp.confidence);
  return (
  <div
  key={comp.id}
  >
  <div>
  <div>
  <h4>
  {comp.variantAType} #{comp.variantAId} vs #
  {comp.variantBId}
  </h4>
  <p>
  {comp.taskScope}
  </p>
  </div>
  <Badge variant="default">
  Promoted
  </Badge>
  </div>
  <div>
  <div>
  <p>
  Promoted (A)
  </p>
  <p>
  {confidencePercent(comp.successRateA)}%
  </p>
  <p>
  N={comp.sampleSizeA}
  </p>
  </div>
  <div>
  <p>
  Replaced (B)
  </p>
  <p>
  {confidencePercent(comp.successRateB)}%
  </p>
  <p>
  N={comp.sampleSizeB}
  </p>
  </div>
  </div>
  <div>
  <div
  style={{ width: `${confPct}%` }}
  />
  </div>
  {comp.promotedAt && (
  <p>
  Promoted: {new Date(comp.promotedAt).toLocaleString()}
  </p>
  )}
  <Button
  variant="default"
  size="sm"
  onClick={() => revertMutation.mutate(comp.id)}
  disabled={revertMutation.isPending}
  >
  <Undo2 />
  Revert Promotion
  </Button>
  </div>
  );
  })}
  </CardContent>
  </div>
 )}

  <div>
  <CardHeader>
  <CardTitle>Learning Configuration</CardTitle>
  <CardDescription>
  Thresholds and automation settings
  </CardDescription>
  </CardHeader>
  <CardContent>
 <div>
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
 <div>
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
 <div>
 <TrendingUp />
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
 <TableHead>Evaluations</TableHead>
 <TableHead>Approval Rate</TableHead>
 <TableHead>Approved</TableHead>
 <TableHead>Rejected</TableHead>
 <TableHead>Avg Truthfulness</TableHead>
 <TableHead>Avg Relevance</TableHead>
 <TableHead>Training Examples</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {outcomeStats!.map((stat) => (
 <TableRow key={stat.taskScope}>
 <TableCell>{stat.taskScope}</TableCell>
 <TableCell>{stat.totalEvaluations}</TableCell>
 <TableCell>
 <span
 >
 {stat.approvalRate}%
 </span>
 </TableCell>
 <TableCell>{stat.approved}</TableCell>
 <TableCell>{stat.rejected}</TableCell>
 <TableCell>{stat.avgTruthfulnessScore ?? "—"}</TableCell>
 <TableCell>{stat.avgRelevanceScore ?? "—"}</TableCell>
 <TableCell>
 <Badge variant={stat.activeTrainingExamples > 0 ? "default" : "secondary"}>
 {stat.activeTrainingExamples}
 </Badge>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 ) : (
 <div>
 <CheckCircle />
 <p>No evaluations recorded yet. Approve or reject resume and cover letter versions to start building outcome data.</p>
 </div>
  )}
   </ContentCard>

   {/* Health Overview */}
   {health && (
    <div>
      <CardHeader>
        <div>
          <Activity />
          <CardTitle>Health Overview</CardTitle>
        </div>
        <CardDescription>Loop health check and system status.</CardDescription>
      </CardHeader>
      <CardContent>
        <div>
          <Badge variant={
            health.overallStatus === "healthy" ? "default" :
            health.overallStatus === "warning" ? "secondary" : "destructive"
          }>
            {health.overallStatus}
          </Badge>
          <span>
            {health.overallStatus === "healthy"
              ? "All systems operating normally"
              : health.overallStatus === "warning"
              ? "Low data volume — collect more signals"
              : "High backlog — run recompute"}
          </span>
        </div>
        <div>
          <div>
            <p>Unprocessed</p>
            <div>{health.unprocessedSignalCount}</div>
          </div>
          <div>
            <p>Variant Stats</p>
            <div>{health.totalVariantStats}</div>
          </div>
          <div>
            <p>Comparisons</p>
            <div>{health.totalComparisons}</div>
          </div>
          <div>
            <p>Suggested</p>
            <div>{health.suggestedComparisons}</div>
          </div>
        </div>
      </CardContent>
    </div>
  )}

   {/* Loop Status Section */}
  <div>
  <CardHeader>
  <HeartPulse />
  <div>
  <CardTitle>Loop Status</CardTitle>
  <CardDescription>
  Feedback signal processing health and data distribution.
  </CardDescription>
  </div>
  </CardHeader>
  <CardContent>
  <div>
  <div>
  <p>
  Unprocessed Signals
  </p>
  <div>
  {stats?.reduce((sum, s) => sum + s.pending, 0) ?? 0}
  </div>
  <p>
  Waiting for recompute
  </p>
  </div>
  <div>
  <p>
  Processed Signals
  </p>
  <div>
  {stats?.reduce((sum, s) => sum + s.successes + s.failures, 0) ?? 0}
  </div>
  <p>
  Successfully analyzed
  </p>
  </div>
  <div>
  <p>
  Total Signals
  </p>
  <div>
  {stats?.reduce((sum, s) => sum + s.successes + s.failures + s.pending, 0) ?? 0}
  </div>
  <p>
  All feedback received
  </p>
  </div>
  </div>

  <div>
  <div>
  <h4>Variant Breakdown</h4>
  {stats?.some((s) => s.lastComputedAt) && (
  <span>
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
  <TableHead>Successes</TableHead>
  <TableHead>Failures</TableHead>
  <TableHead>Pending</TableHead>
  <TableHead>Total Sample</TableHead>
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
  <TableCell>{type}</TableCell>
  <TableCell colSpan={4}>No data</TableCell>
  </TableRow>
  );
  }

  return (
  <TableRow key={type}>
  <TableCell>{type}</TableCell>
  <TableCell>{successes}</TableCell>
  <TableCell>{failures}</TableCell>
  <TableCell>{pending}</TableCell>
  <TableCell>{total}</TableCell>
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
  <div>
  <AlertCircle />
  <div>
  <p>Waiting for more data</p>
  <p>
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
  <div>
  <Users />
  <SectionHeader
  title="Agent Roles"
  description="Agent role definitions with personality, goals, and skill tags. Edit role fields in the AI Pipeline Hub → click a task → Role tab."
  />
  </div>
  <p>
  Role personality, goals, and skill tags are now prepended to the system prompt at AI call time. Edit them in the{" "}
  <Link to="/pipeline-diagram">
  AI Pipeline Hub
  </Link>{" "}
  Role tab.
  </p>
  {promptVersions?.some((pv) => pv.roleLabel) ? (
  <div>
  {promptVersions
  .filter((pv: any) => pv.roleLabel)
  .map((pv: any) => (
  <div key={pv.id}>
  <div>
  <div>
  <h3>{pv.roleLabel}</h3>
  <Badge variant="outline">{pv.taskScope}</Badge>
  </div>
  <Badge variant={pv.isActive ? "default" : "secondary"}>
  {pv.isActive ? "Active" : "Inactive"} v{pv.version}
  </Badge>
  </div>
  {pv.personality && (
  <div>
  <p>Personality</p>
  <p>{pv.personality}</p>
  </div>
  )}
  {pv.goals && (
  <div>
  <p>Goals</p>
  <p>{pv.goals}</p>
  </div>
  )}
  {pv.skillTags?.length > 0 && (
  <div>
  <p>Skill Tags</p>
  <div>
  {pv.skillTags.map((tag: string) => (
  <Badge key={tag} variant="secondary">{tag}</Badge>
  ))}
  </div>
  </div>
  )}
  </div>
  ))}
  </div>
  ) : (
  <div>
  <AlertCircle />
  <p>Agent roles will appear here once prompt versions are seeded. Run the DB migration to populate role definitions.</p>
  </div>
  )}
  </ContentCard>

  </div>
 );
}
