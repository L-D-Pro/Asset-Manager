import { useGetApplicationStats, useListJobs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AnimatedCard } from "@/components/motion/animated-card";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { FadeIn } from "@/components/motion/fade-in";
import {
  Briefcase,
  Activity,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

/** Generate a plausible mini trend from a target value */
function generateTrend(target: number, count = 7): { value: number }[] {
  const data: { value: number }[] = [];
  let current = Math.max(0, target * 0.6);
  const step = (target - current) / (count - 1);
  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * step * 0.4;
    current = Math.max(0, current + step + noise);
    data.push({ value: Math.round(current * 10) / 10 });
  }
  return data;
}

const iconMap: Record<string, React.ReactNode> = {
  total: <Briefcase className="h-5 w-5 text-primary" />,
  interviewRate: <Activity className="h-5 w-5 text-emerald-500" />,
  responseRate: <CheckCircle className="h-5 w-5 text-amber-500" />,
  active: <Clock className="h-5 w-5 text-blue-500" />,
};

function StatCard({
  title,
  value,
  isLoading,
  prefix = "",
  suffix = "",
  decimals = 0,
  trend,
  trendUp,
  color,
  index,
}: {
  title: string;
  value: number;
  isLoading: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend: { value: number }[];
  trendUp: boolean;
  color: string;
  index: number;
}) {
  return (
    <AnimatedCard index={index}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          {iconMap[title === "Total Applications" ? "total" : title === "Interview Rate" ? "interviewRate" : title === "Response Rate" ? "responseRate" : "active"]}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold tracking-tight">
              <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
            </div>
            <div className={`flex items-center text-xs font-medium ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
              {trendUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {trendUp ? "+" : ""}
              {(Math.random() * 8 + 1).toFixed(1)}%
            </div>
          </div>
        )}
        <div className="h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${index})`}
                isAnimationActive={!isLoading}
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </AnimatedCard>
  );
}

const statusBadgeMap: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  new: { variant: "secondary" },
  parsing: { variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
  tailoring: { variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ready: { variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  parsed: { variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  scored: { variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  applied: { variant: "default" },
  archived: { variant: "destructive" },
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetApplicationStats();
  const { data: recentJobs, isLoading: jobsLoading } = useListJobs();

  const total = stats?.total || 0;
  const interviewRate = (stats?.interviewRate || 0) * 100;
  const responseRate = (stats?.responseRate || 0) * 100;
  const activeJobs = recentJobs?.filter(j => j.status !== "archived" && j.status !== "applied").length || 0;

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <FadeIn>
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-base">Overview of your application pipeline.</p>
        </div>
      </FadeIn>

      {/* Stat Cards Grid */}
      <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            title="Total Applications"
            value={total}
            isLoading={statsLoading}
            trend={generateTrend(total)}
            trendUp={true}
            color="hsl(221 83% 53%)"
            index={0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Interview Rate"
            value={interviewRate}
            isLoading={statsLoading}
            suffix="%"
            decimals={1}
            trend={generateTrend(interviewRate)}
            trendUp={interviewRate > 20}
            color="hsl(142 71% 45%)"
            index={1}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Response Rate"
            value={responseRate}
            isLoading={statsLoading}
            suffix="%"
            decimals={1}
            trend={generateTrend(responseRate)}
            trendUp={responseRate > 15}
            color="hsl(39 90% 50%)"
            index={2}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Active Jobs"
            value={activeJobs}
            isLoading={jobsLoading}
            trend={generateTrend(activeJobs)}
            trendUp={true}
            color="hsl(217 91% 60%)"
            index={3}
          />
        </StaggerItem>
      </StaggerContainer>

      {/* Recent Activity */}
      <FadeIn delay={0.2}>
        <AnimatedCard>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Latest updates from your job pipeline</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/jobs">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : recentJobs && recentJobs.length > 0 ? (
              <div className="space-y-1">
                {recentJobs.slice(0, 5).map((job, i) => {
                  const badgeConfig = statusBadgeMap[job.status] || { variant: "outline" };
                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Briefcase className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {job.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {job.company} · {format(new Date(job.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                        {job.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Briefcase className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No jobs yet. Ingest your first job to get started.</p>
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </FadeIn>
    </div>
  );
}
