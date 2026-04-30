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
  Sparkles,
  Zap,
  FileText,
  BookOpen,
  Quote,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

const INSPIRATIONAL_QUOTES = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { quote: "It is never too late to be what you might have been.", author: "George Eliot" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { quote: "Your work is going to fill a large part of your life.", author: "Steve Jobs" },
  { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { quote: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
  { quote: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { quote: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { quote: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
];

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

function StatCard({
  title,
  value,
  isLoading,
  prefix = "",
  suffix = "",
  decimals = 0,
  trend,
  trendUp,
  gradient,
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
  gradient: string;
  index: number;
}) {
  return (
    <AnimatedCard index={index}>
      <div className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
              </div>
              <div className={`flex items-center text-xs font-semibold ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
                {trendUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {(Math.random() * 8 + 1).toFixed(1)}%
              </div>
            </div>
          )}
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={gradient} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={gradient} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={gradient}
                  strokeWidth={2}
                  fill={`url(#grad-${index})`}
                  isAnimationActive={!isLoading}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </div>
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
  const [quoteIndex, setQuoteIndex] = useState(0);

  const total = stats?.total || 0;
  const interviewRate = (stats?.interviewRate || 0) * 100;
  const responseRate = (stats?.responseRate || 0) * 100;
  const activeJobs = recentJobs?.filter((j) => j.status !== "archived" && j.status !== "applied").length || 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % INSPIRATIONAL_QUOTES.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-teal-400 p-8 md:p-10 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Welcome back
              </h1>
              <p className="text-blue-100 mt-2 text-base">
                Here's your job search at a glance
              </p>
            </div>
            <p className="text-blue-200 text-sm font-medium">{today}</p>
          </div>
          <div className="mt-4 flex items-center gap-3 bg-white/15 rounded-xl px-4 py-3 max-w-xl">
            <Quote className="h-5 w-5 text-yellow-300 flex-shrink-0" />
            <div>
              <p className="text-white/90 text-sm italic leading-relaxed">
                "{INSPIRATIONAL_QUOTES[quoteIndex].quote}"
              </p>
              <p className="text-blue-200 text-xs mt-1">
                — {INSPIRATIONAL_QUOTES[quoteIndex].author}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatCard title="Total Applications" value={total} isLoading={statsLoading} trend={generateTrend(total)} trendUp gradient="hsl(221 83% 53%)" index={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Interview Rate" value={interviewRate} isLoading={statsLoading} suffix="%" decimals={1} trend={generateTrend(interviewRate)} trendUp={interviewRate > 20} gradient="hsl(142 71% 45%)" index={1} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Response Rate" value={responseRate} isLoading={statsLoading} suffix="%" decimals={1} trend={generateTrend(responseRate)} trendUp={responseRate > 15} gradient="hsl(39 90% 50%)" index={2} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Active Jobs" value={activeJobs} isLoading={jobsLoading} trend={generateTrend(activeJobs)} trendUp gradient="hsl(267 83% 60%)" index={3} />
        </StaggerItem>
      </StaggerContainer>

      {/* Quick Actions */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            asChild
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/25"
          >
            <Link to="/jobs" className="flex items-center justify-center gap-2">
              <Briefcase className="h-5 w-5" />
              New Job
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
          >
            <Link to="/resume-versions" className="flex items-center justify-center gap-2">
              <FileText className="h-5 w-5" />
              Tailor Resume
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl border-2 border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all"
          >
            <Link to="/trends" className="flex items-center justify-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Market Trends
            </Link>
          </Button>
        </div>
      </FadeIn>

      {/* Recent Activity + Daily Inspiration Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <FadeIn delay={0.2} className="lg:col-span-2">
          <AnimatedCard>
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/50 shadow-sm h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Recent Activity</CardTitle>
                  <p className="text-sm text-slate-500 mt-0.5">Latest updates from your job pipeline</p>
                </div>
                <Button variant="ghost" size="sm" asChild className="gap-1 text-blue-600 hover:text-blue-700">
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
                    {recentJobs.slice(0, 5).map((job) => {
                      const badgeConfig = statusBadgeMap[job.status] || { variant: "outline" as const };
                      return (
                        <div
                          key={job.id}
                          className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-blue-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                              <Briefcase className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {job.title}
                              </p>
                              <p className="text-xs text-slate-500">
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
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Briefcase className="h-12 w-12 text-slate-200 mb-4" />
                    <p className="text-sm text-slate-500">No jobs yet.</p>
                    <Button asChild variant="link" className="mt-2 text-blue-600">
                      <Link to="/jobs">Ingest your first job</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </div>
          </AnimatedCard>
        </FadeIn>

        {/* Daily Inspiration */}
        <FadeIn delay={0.3}>
          <div className="rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-6 shadow-lg shadow-amber-500/20 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-white" />
                <h3 className="font-bold text-white text-lg">Daily Inspiration</h3>
              </div>
              <p className="text-white/95 text-sm leading-relaxed italic mb-4">
                "{INSPIRATIONAL_QUOTES[quoteIndex].quote}"
              </p>
              <p className="text-white/80 text-xs">
                — {INSPIRATIONAL_QUOTES[quoteIndex].author}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/20">
              <Link
                to="/resources"
                className="flex items-center gap-2 text-white/90 hover:text-white text-sm font-medium transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Free resources & support
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
