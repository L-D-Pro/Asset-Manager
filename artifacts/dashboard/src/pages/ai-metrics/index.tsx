import { useMemo } from "react";
import { useGetAiMetricsSnapshot } from "@workspace/api-client-react";
import type { GetAiMetricsSnapshotMetricsVersion } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/api-errors";
import { cn } from "@/lib/utils";
import { AlertTriangle, Brain, TrendingUp } from "lucide-react";

const METRICS_VERSION: GetAiMetricsSnapshotMetricsVersion = "v1";
const TASK_SCOPES = ["resume_review", "cover_letter_review"] as const;

type TaskScope = (typeof TASK_SCOPES)[number];

type PromptAggRow = {
 promptVersionId: string;
 evaluationCount: number;
 approvalRate: number | null;
 avgEditDistance: number | null;
 avgRubricScores: Record<string, number | null>;
};

type BucketRow = {
 bucketStartInclusive: string;
 evaluationCount: number;
 approvalRate: number | null;
 avgEditDistance: number | null;
};

export default function AiMetricsPage() {
 const now = new Date();
 const windowEnd = now.toISOString();
 const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

 return (
 <div>
 <PageHeader
 title="AI Metrics"
 subtitle="Track prompt version performance, success rates, and cost efficiency over time."
 variant="data"
 />

 <Tabs defaultValue={TASK_SCOPES[0]}>
 <TabsList>
 {TASK_SCOPES.map((scope) => (
 <TabsTrigger key={scope} value={scope}>
 {scope}
 </TabsTrigger>
 ))}
 </TabsList>
 {TASK_SCOPES.map((scope) => (
 <TabsContent key={scope} value={scope}>
 <TaskScopePanel scope={scope} windowStart={windowStart} windowEnd={windowEnd} />
 </TabsContent>
 ))}
 </Tabs>
 </div>
 );
}

function TaskScopePanel({ scope, windowStart, windowEnd }: { scope: TaskScope; windowStart: string; windowEnd: string }) {
 const query = useGetAiMetricsSnapshot({
 metricsVersion: METRICS_VERSION,
 windowStart,
 windowEnd,
 taskScope: scope,
 });

 const snapshot = query.data as any;

 const approvalRate = useMemo(() => computeApprovalRate(snapshot?.aggregates?.approvalOutcomeCounts), [snapshot]);

 const avgEditDistance = useMemo(() => getAvgEditDistance(snapshot), [snapshot]);

 const avgRubric = useMemo(() => getAvgRubricAverages(snapshot), [snapshot]);

 const promptRows = useMemo(() => toPromptRows(snapshot), [snapshot]);

 const seriesRows = useMemo(() => toBucketRows(snapshot), [snapshot]);

 const lift = useMemo(() => computeLift(promptRows), [promptRows]);

 return (
 <div>
 {query.isLoading ? <p>Loading…</p> : null}
 {query.isError ? (
 <Alert variant="destructive">
 <AlertTitle>Failed to load snapshot</AlertTitle>
 <AlertDescription>{getErrorMessage(query.error, "Please refresh and try again.")}</AlertDescription>
 </Alert>
 ) : null}

 {snapshot ? <DegradedBanner snapshot={snapshot} /> : null}

 {snapshot?.lastKnownGoodSnapshot === null ? (
 <p>
 No last-known-good snapshot recorded yet. (Persistence is a follow-up; this page currently surfaces the field
 only.)
 </p>
 ) : null}

 <div>
 <MetricCard title="Evaluations" value={snapshot?.aggregates?.evaluationCount ?? 0} />
 <MetricCard title="Approval Rate" value={formatPercent(approvalRate)} />
 <MetricCard title="Avg Edit Distance" value={formatNumber(avgEditDistance)} />
 <MetricCard
 title="Avg Rubric"
 value={formatNumber(avgRubric?.overall)}
 description={avgRubric ? `truth ${formatNumber(avgRubric.truthfulness)} · rel ${formatNumber(avgRubric.relevance)}` : undefined}
 />
 </div>

  <ContentCard>
  <CardHeader>
  <CardTitle>
 <TrendingUp />
 Trend (bucketed)
 </CardTitle>
 <CardDescription>
 Buckets aligned to granularityMs={snapshot?.window?.granularityMs ?? "?"}. Times are snapshot bucket start.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div>
 <table>
 <thead>
 <tr>
 <th>Bucket</th>
 <th>n</th>
 <th>Approval</th>
 <th>Avg edit dist</th>
 </tr>
 </thead>
 <tbody>
 {seriesRows.length === 0 ? (
 <tr>
 <td colSpan={4}>
 No data in this window.
 </td>
 </tr>
 ) : (
 seriesRows.map((row) => (
 <tr key={row.bucketStartInclusive}>
 <td>{formatIsoDateTime(row.bucketStartInclusive)}</td>
 <td>{row.evaluationCount}</td>
 <td>{formatPercent(row.approvalRate)}</td>
 <td>{formatNumber(row.avgEditDistance)}</td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </CardContent>
 </ContentCard>

  <ContentCard>
  <CardHeader>
  <CardTitle>Prompt-version comparison</CardTitle>
 <CardDescription>Grouped by promptVersionId ("unknown" means built-in / not captured).</CardDescription>
 </CardHeader>
 <CardContent>
 {lift ? (
 <Alert>
 <AlertTitle>
 <TrendingUp />
 Lift summary
 </AlertTitle>
 <AlertDescription>
 Best prompt ({lift.best.promptVersionId}) vs baseline ({lift.baseline.promptVersionId}): approval Δ{" "}
 <span> 
 {formatPercent(lift.deltaApprovalRate)}
 </span>
 , edit distance Δ {formatNumber(lift.deltaAvgEditDistance)}.
 </AlertDescription>
 </Alert>
 ) : null}

 <div>
 <table>
 <thead>
 <tr>
 <th>Prompt</th>
 <th>n</th>
 <th>Approval</th>
 <th>Avg edit dist</th>
 <th>Avg rubric</th>
 </tr>
 </thead>
 <tbody>
 {promptRows.length === 0 ? (
 <tr>
 <td colSpan={5}>
 No prompt-version aggregates in this window.
 </td>
 </tr>
 ) : (
 promptRows.map((row) => (
 <tr key={row.promptVersionId}>
 <td>
 <span>{row.promptVersionId}</span>
 {row.promptVersionId === "unknown" ? <Badge variant="outline">built-in</Badge> : null}
 </td>
 <td>{row.evaluationCount}</td>
 <td>{formatPercent(row.approvalRate)}</td>
 <td>{formatNumber(row.avgEditDistance)}</td>
 <td>{formatNumber(overallFromRubric(row.avgRubricScores))}</td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </CardContent>
 </ContentCard>
 </div>
 );
}

function DegradedBanner({ snapshot }: { snapshot: any }) {
 if (snapshot.status !== "degraded") return null;

 return (
 <Alert>
 <AlertTriangle />
 <AlertTitle>Metrics snapshot degraded</AlertTitle>
 <AlertDescription>
 <p>
 Some evaluations were excluded because reproducibility or lineage checks failed. Use the normalized window to
 reproduce the exact snapshot.
 </p>
 <div>
 <div>
 Window: <span>{snapshot.window.startInclusive}</span> →{" "}
 <span>{snapshot.window.endExclusive}</span>
 </div>
 <div>
 Reasons: {snapshot.degradedReasons.length ? snapshot.degradedReasons.join(", ") : "(none)"}
 </div>
 </div>
 </AlertDescription>
 </Alert>
 );
}

function MetricCard({ title, value, description }: { title: string; value: string | number; description?: string }) {
 return (
  <ContentCard>
  <CardContent>
 <div>
 <span>{title}</span>
 </div>
 <div>{value}</div>
 {description ? <div>{description}</div> : null}
 </CardContent>
 </ContentCard>
 );
}

function computeApprovalRate(counts?: Record<string, number> | null): number | null {
 if (!counts) return null;
 const approved = counts["approved"] ?? 0;
 const total = Object.values(counts).reduce((a, b) => a + b, 0);
 if (total === 0) return null;
 return approved / total;
}

function formatPercent(value: number | null | undefined): string {
 if (value === null || value === undefined) return "—";
 return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined): string {
 if (value === null || value === undefined || !Number.isFinite(value)) return "—";
 return value.toFixed(2);
}

function formatIsoDateTime(iso: string): string {
 const date = new Date(iso);
 if (Number.isNaN(date.getTime())) return iso;
 return date.toLocaleString();
}

function getAvgEditDistance(snapshot?: any): number | null {
 const aggregates = snapshot?.aggregates as unknown as { byPromptVersion?: Record<string, { avgEditDistance?: number | null }> };
 const byPrompt = aggregates?.byPromptVersion;
 if (!byPrompt) return null;

 const values = Object.values(byPrompt)
 .map((row) => row.avgEditDistance)
 .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

 if (!values.length) return null;
 return values.reduce((a, b) => a + b, 0) / values.length;
}

function getAvgRubricAverages(snapshot?: any):
 | { overall: number | null; truthfulness: number | null; relevance: number | null }
 | null {
 const aggregates = snapshot?.aggregates as unknown as {
 byPromptVersion?: Record<string, { avgRubricScores?: Record<string, number | null> }>;
 };
 const byPrompt = aggregates?.byPromptVersion;
 if (!byPrompt) return null;

 const allScores = Object.values(byPrompt)
 .map((row) => row.avgRubricScores)
 .filter((row): row is Record<string, number | null> => !!row);

 if (!allScores.length) return null;

 const truthfulness = average(allScores.map((r) => r.truthfulnessScore ?? null));
 const relevance = average(allScores.map((r) => r.relevanceScore ?? null));
 const formatting = average(allScores.map((r) => r.formattingScore ?? null));
 const attribution = average(allScores.map((r) => r.attributionScore ?? null));

 const overall = average([truthfulness, relevance, formatting, attribution]);

 return { overall, truthfulness, relevance };
}

function average(values: Array<number | null | undefined>): number | null {
 const filtered = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
 if (!filtered.length) return null;
 return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function overallFromRubric(scores?: Record<string, number | null> | null): number | null {
 if (!scores) return null;
 return average([scores.truthfulnessScore, scores.relevanceScore, scores.formattingScore, scores.attributionScore]);
}

function toPromptRows(snapshot?: any): PromptAggRow[] {
 const aggregates = snapshot?.aggregates as unknown as {
 byPromptVersion?: Record<
 string,
 {
 evaluationCount: number;
 approvalOutcomeCounts: Record<string, number>;
 avgEditDistance: number | null;
 avgRubricScores: Record<string, number | null>;
 }
 >;
 };

 const byPrompt = aggregates?.byPromptVersion;
 if (!byPrompt) return [];

 return Object.entries(byPrompt)
 .map(([promptVersionId, row]) => ({
 promptVersionId,
 evaluationCount: row.evaluationCount,
 approvalRate: computeApprovalRate(row.approvalOutcomeCounts),
 avgEditDistance: row.avgEditDistance,
 avgRubricScores: row.avgRubricScores,
 }))
 .sort((a, b) => b.evaluationCount - a.evaluationCount);
}

function toBucketRows(snapshot?: any): BucketRow[] {
 if (!snapshot || typeof snapshot !== "object") {
 return [];
 }

 const series = (snapshot as { series?: Array<any> }).series as
 | Array<{
 bucketStartInclusive: string;
 evaluationCount: number;
 approvalOutcomeCounts: Record<string, number>;
 avgEditDistance: number | null;
 }>
 | undefined;

 if (!series) return [];

 return series.map((row) => ({
 bucketStartInclusive: row.bucketStartInclusive,
 evaluationCount: row.evaluationCount,
 approvalRate: computeApprovalRate(row.approvalOutcomeCounts),
 avgEditDistance: row.avgEditDistance,
 }));
}

function computeLift(rows: PromptAggRow[]):
 | {
 baseline: PromptAggRow;
 best: PromptAggRow;
 deltaApprovalRate: number | null;
 deltaAvgEditDistance: number | null;
 }
 | null {
 if (rows.length < 2) return null;

 const baseline = rows.find((r) => r.promptVersionId === "unknown") ?? rows[0];
 const best = [...rows]
 .filter((r) => r.approvalRate !== null)
 .sort((a, b) => (b.approvalRate ?? -1) - (a.approvalRate ?? -1))[0];

 if (!baseline || !best) return null;

 const deltaApprovalRate =
 baseline.approvalRate !== null && best.approvalRate !== null
 ? best.approvalRate - baseline.approvalRate
 : null;

 const deltaAvgEditDistance =
 baseline.avgEditDistance !== null && best.avgEditDistance !== null
 ? best.avgEditDistance - baseline.avgEditDistance
 : null;

 return { baseline, best, deltaApprovalRate, deltaAvgEditDistance };
}
