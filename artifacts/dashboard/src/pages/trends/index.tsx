import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
 useResearchTrends,
 useListJobBoardSources,
 type MarketAnalysis,
 type ResearchTrendsResponse,
 type ResearchTrendsBodyExperienceLevel,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Database, Clock } from "lucide-react";
import { TrendsSearchForm } from "@/components/trends/trends-search-form";
import { MarketOverviewCard } from "@/components/trends/market-overview-card";
import { SkillsMatrix } from "@/components/trends/skills-matrix";
import { CertificationsTable } from "@/components/trends/certifications-table";
import { TrendsTimeline } from "@/components/trends/trends-timeline";
import { ActionPlanChecklist } from "@/components/trends/action-plan-checklist";
import { JobMatchCard } from "@/components/trends/job-match-card";

export default function TrendsPage() {
 const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
 const [jobMatches, setJobMatches] = useState<
 ResearchTrendsResponse["jobMatches"]
 >([]);
 const [isCached, setIsCached] = useState(false);

 const { data: sources } = useListJobBoardSources();

 const mutation = useResearchTrends({
 mutation: {
 onSuccess: (data) => {
 setAnalysis(data.analysis);
 setJobMatches(data.jobMatches);
 setIsCached(data.cached);
 },
 onError: () => {
 setAnalysis(null);
 setJobMatches([]);
 },
 },
 });

 const handleSearch = (params: {
 jobTitle: string;
 location: string;
 experienceLevel: string;
 salaryTarget: string;
 }) => {
 setAnalysis(null);
 setJobMatches([]);
 setIsCached(false);
 mutation.mutate({
 data: {
 jobTitle: params.jobTitle,
 location: params.location || undefined,
 experienceLevel: (params.experienceLevel || undefined) as
 | ResearchTrendsBodyExperienceLevel
 | undefined,
 salaryTarget: params.salaryTarget ? Number(params.salaryTarget) : undefined,
 },
 });
 };

 return (
  <div>
  <div>
  <PageHeader title="Market Trends" subtitle="AI-powered market analysis to understand demand, skills, salaries, and certifications for any job role." />
  <TrendsSearchForm
  onSearch={handleSearch}
  isLoading={mutation.isPending}
  />
  {sources && sources.length > 0 && (
  <p>
  <Database />
  {sources.length} job board source
  {sources.length !== 1 ? "s" : ""} configured — results will be
  enriched with live listings
  </p>
  )}
  </div>

 <div>
 {mutation.isError && (
 <Alert variant="destructive">
 <AlertCircle />
 <AlertDescription>
 Failed to generate market analysis. The AI service may be
 temporarily unavailable. Please try again.
 </AlertDescription>
 </Alert>
 )}

 {analysis ? (
 <div>
 {isCached && (
 <div>
 <Clock />
 Served from cache (refreshes daily)
 </div>
 )}

 <Tabs defaultValue="overview">
 <TabsList>
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="skills">Skills</TabsTrigger>
 <TabsTrigger value="certifications">Certifications</TabsTrigger>
 <TabsTrigger value="trends">Trends</TabsTrigger>
 <TabsTrigger value="action-plan">Action Plan</TabsTrigger>
 </TabsList>

 <TabsContent value="overview">
 <div>
 <MarketOverviewCard overview={analysis.marketOverview} />
  <ContentCard padding="none">
  <CardHeader>
  <CardTitle>
  Salary Insights
  </CardTitle>
  </CardHeader>
  <CardContent>
 <div>
 <div>
 <p>Low</p>
 <p>
 $
 {analysis.salaryInsights.rangeLow.toLocaleString()}
 </p>
 </div>
 <div>
 <p>
 Median
 </p>
 <p>
 $
 {analysis.salaryInsights.median.toLocaleString()}
 </p>
 </div>
 <div>
 <p>High</p>
 <p>
 $
 {analysis.salaryInsights.rangeHigh.toLocaleString()}
 </p>
 </div>
 </div>
 <div>
 <p>
 Key Factors
 </p>
 <div>
 {analysis.salaryInsights.factors.map((f) => (
 <Badge key={f} variant="outline">
 {f}
 </Badge>
 ))}
 </div>
 </div>
  </CardContent>
  </ContentCard>
  </div>
 </TabsContent>

 <TabsContent value="skills">
 <SkillsMatrix skills={analysis.requiredSkills} />
 </TabsContent>

 <TabsContent value="certifications">
 <CertificationsTable
 certifications={analysis.certifications}
 />
 </TabsContent>

 <TabsContent value="trends">
 <TrendsTimeline trends={analysis.trends} />
 </TabsContent>

 <TabsContent value="action-plan">
 <ActionPlanChecklist actionPlan={analysis.actionPlan} />
 </TabsContent>
 </Tabs>

 {jobMatches.length > 0 && (
 <div>
 <h2>
 Matching Job Listings ({jobMatches.length})
 </h2>
 <div>
 {jobMatches.map((job) => (
 <JobMatchCard key={job.id} job={job} />
 ))}
 </div>
 </div>
 )}
 </div>
 ) : (
 !mutation.isPending && (
 <div>
 <TrendingUp />
 <p>
 Enter a job title above to generate a market analysis with
 AI-powered insights.
 </p>
 </div>
 )
 )}

 {mutation.isPending && (
 <div>
 <div />
 </div>
 )}
 </div>
 </div>
 );
}
