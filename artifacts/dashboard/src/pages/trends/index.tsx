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
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-4xl font-bold font-[family-name:var(--font-heading)] text-foreground">Market Trends</h1>
        </div>
        <p className="text-muted text-lg mb-4">
          AI-powered market analysis to understand demand, skills, salaries, and
          certifications for any job role.
        </p>
        <TrendsSearchForm
          onSearch={handleSearch}
          isLoading={mutation.isPending}
        />
        {sources && sources.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Database className="h-3 w-3" />
            {sources.length} job board source
            {sources.length !== 1 ? "s" : ""} configured — results will be
            enriched with live listings
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {mutation.isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to generate market analysis. The AI service may be
              temporarily unavailable. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {analysis ? (
          <div className="space-y-6">
            {isCached && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Served from cache (refreshes daily)
              </div>
            )}

            <Tabs defaultValue="overview" className="space-y-4 gamify-radius-chunky">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="certifications">Certifications</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="action-plan">Action Plan</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MarketOverviewCard overview={analysis.marketOverview} />
                  <Card className="gamify-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Salary Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-1 text-center p-3 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground">Low</p>
                          <p className="text-xl font-bold">
                            $
                            {analysis.salaryInsights.rangeLow.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex-1 text-center p-3 rounded-lg bg-primary/10">
                          <p className="text-xs text-muted-foreground">
                            Median
                          </p>
                          <p className="text-xl font-bold text-primary">
                            $
                            {analysis.salaryInsights.median.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex-1 text-center p-3 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground">High</p>
                          <p className="text-xl font-bold">
                            $
                            {analysis.salaryInsights.rangeHigh.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1">
                          Key Factors
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {analysis.salaryInsights.factors.map((f) => (
                            <Badge key={f} variant="outline" className="text-xs">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">
                  Matching Job Listings ({jobMatches.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {jobMatches.map((job) => (
                    <JobMatchCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          !mutation.isPending && (
            <div className="text-center text-muted-foreground py-16">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>
                Enter a job title above to generate a market analysis with
                AI-powered insights.
              </p>
            </div>
          )
        )}

        {mutation.isPending && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
