import { useGetApplicationStats, useListJobs } from "@workspace/api-client-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ContentCard } from "@/components/ui/content-card";
import { AnimatedCard } from "@/components/motion/animated-card";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { FadeIn } from "@/components/motion/fade-in";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  FileText,
  Quote,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useResolvedUiConfig } from "@/ui-shell/use-ui-shell-config";
import { XPCard, StreakFlame, GamifiedBadge, AchievementToaster } from "@/components/gamification";
import { useGamificationStats, useMarkAchievementSeen } from "@/hooks/use-gamification";

const INSPIRATIONAL_QUOTES = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { quote: "It is never too late to be what you might have been.", author: "George Eliot" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
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
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(150deg,hsl(var(--card)),hsl(var(--card))_68%,hsl(var(--accent)/0.08))] text-card-foreground backdrop-blur-xl shadow-[0_10px_28px_rgba(20,24,33,0.08)] transition-all duration-300 hover:border-primary/35 hover:shadow-[0_16px_40px_rgba(20,24,33,0.12)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold tracking-normal text-foreground">
                <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
              </div>
              <div className={`flex items-center text-xs font-medium ${trendUp ? "text-emerald-600 dark:text-emerald-300" : "text-red-500 dark:text-red-300"}`}>
                {trendUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {(Math.random() * 8 + 1).toFixed(1)}%
              </div>
            </div>
          )}
          <div className="h-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={`dash-grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.24} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#dash-grad-${index})`}
                  isAnimationActive={!isLoading}
                  animationDuration={900}
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
  parsing: { variant: "outline", className: "bg-primary/10 text-primary border-primary/20" },
  tailoring: { variant: "outline", className: "bg-primary/10 text-primary border-primary/20" },
  ready: { variant: "outline", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25" },
  parsed: { variant: "outline", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25" },
  scored: { variant: "outline", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25" },
  applied: { variant: "default" },
  archived: { variant: "destructive" },
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetApplicationStats();
  const { data: recentJobs, isLoading: jobsLoading } = useListJobs();
  const uiConfig = useResolvedUiConfig();
  const [quoteIndex, setQuoteIndex] = useState(0);

  const total = stats?.total || 0;
  const interviewRate = (stats?.interviewRate || 0) * 100;
  const responseRate = (stats?.responseRate || 0) * 100;
  const activeJobs = recentJobs?.filter((j) => j.status !== "archived" && j.status !== "applied").length || 0;

  const { data: gStats, isLoading: gLoading } = useGamificationStats()
  const markSeen = useMarkAchievementSeen()
  const [dismissedAchievements, setDismissedAchievements] = useState<Set<number>>(new Set())

  const achievements = gStats?.recentAchievements?.filter(a => !a.seen && !dismissedAchievements.has(a.id)) ?? []

  const handleDismissAchievement = useCallback((id: string) => {
    const numId = Number(id)
    markSeen.mutate(numId)
    setDismissedAchievements(prev => new Set(prev).add(numId))
  }, [markSeen])

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % INSPIRATIONAL_QUOTES.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const today = format(new Date(), "EEEE, MMMM d");
  const slotItems = uiConfig.slots.dashboardGrid;
  const slotLookup = new Map(slotItems.map((item) => [item.componentKey, item]));
  const getOrder = (key: string, fallbackOrder: number) => slotLookup.get(key)?.order ?? fallbackOrder;
  const isVisible = (key: string) => slotLookup.get(key)?.visibility ?? true;

  return (
    <div className="flex flex-col gap-5">
      {!gLoading && gStats && (
        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <XPCard
              totalXp={gStats.totalXp}
              currentLevel={gStats.currentLevel}
              xpToNextLevel={gStats.xpToNextLevel}
            />
            <StreakFlame
              streak={gStats.currentStreak}
              longestStreak={gStats.longestStreak}
            />
            <div className="grid grid-cols-2 gap-2 content-center">
              <GamifiedBadge
                icon="🏆"
                name="Achievements"
                description={`${gStats.achievementsUnlocked} unlocked`}
                variant="gold"
              />
              <GamifiedBadge
                icon="✅"
                name="Quests"
                description={`${gStats.questsCompleted} completed`}
                variant="silver"
              />
            </div>
          </div>

          <AchievementToaster
            toasts={achievements.map(a => ({
              id: String(a.id),
              icon: a.iconName === "trophy" ? "🏆" : a.iconName === "fire" ? "🔥" : a.iconName === "star" ? "⭐" : "🎯",
              name: a.name,
              description: a.description,
            }))}
            onDismiss={handleDismissAchievement}
          />
        </div>
      )}

      {isVisible("dashboard-hero") && (
        <ContentCard
          style={{ order: getOrder("dashboard-hero", 0) } as CSSProperties}
          className="relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-primary">Command Center</p>
              <h1 className="text-2xl font-semibold text-foreground tracking-normal">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Your job search pipeline, focused for {today}.</p>
            </div>
            <div className="flex max-w-xl items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm leading-relaxed text-foreground">"{INSPIRATIONAL_QUOTES[quoteIndex].quote}"</p>
                <p className="mt-0.5 text-xs text-muted-foreground">- {INSPIRATIONAL_QUOTES[quoteIndex].author}</p>
              </div>
            </div>
          </div>
        </ContentCard>
      )}

      {isVisible("dashboard-stats") && (
        <div style={{ order: getOrder("dashboard-stats", 1) }}>
          <StaggerContainer className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <StaggerItem>
              <StatCard title="Total Applications" value={total} isLoading={statsLoading} trend={generateTrend(total)} trendUp color="hsl(var(--primary))" index={0} />
            </StaggerItem>
            <StaggerItem>
              <StatCard title="Interview Rate" value={interviewRate} isLoading={statsLoading} suffix="%" decimals={1} trend={generateTrend(interviewRate)} trendUp={interviewRate > 20} color="rgb(16 185 129)" index={1} />
            </StaggerItem>
            <StaggerItem>
              <StatCard title="Response Rate" value={responseRate} isLoading={statsLoading} suffix="%" decimals={1} trend={generateTrend(responseRate)} trendUp={responseRate > 15} color="rgb(245 158 11)" index={2} />
            </StaggerItem>
            <StaggerItem>
              <StatCard title="Active Jobs" value={activeJobs} isLoading={jobsLoading} trend={generateTrend(activeJobs)} trendUp color="rgb(6 182 212)" index={3} />
            </StaggerItem>
          </StaggerContainer>
        </div>
      )}

      {isVisible("dashboard-actions") && (
        <FadeIn delay={0.1} className="contents">
          <div style={{ order: getOrder("dashboard-actions", 2) }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Button asChild size="lg" className="h-11 rounded-md font-medium shadow-sm">
                <Link to="/jobs" className="flex items-center justify-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  New Job
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-md border-border font-medium hover:border-primary/35 hover:bg-primary/5">
                <Link to="/resume-versions" className="flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4" />
                  Tailor Resume
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-md border-border font-medium hover:border-primary/35 hover:bg-primary/5">
                <Link to="/trends" className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Market Trends
                </Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      {isVisible("dashboard-activity") && (
        <div style={{ order: getOrder("dashboard-activity", 3) }} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <FadeIn delay={0.2} className="lg:col-span-2">
            <ContentCard padding="none" className="h-full">
              <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Recent Activity</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">Latest updates from your job pipeline</p>
                </div>
                <Button variant="ghost" size="sm" asChild className="gap-1 text-primary hover:text-primary/85">
                  <Link to="/jobs">
                    View all <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                {jobsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : recentJobs && recentJobs.length > 0 ? (
                  <div className="divide-y divide-border/70">
                    {recentJobs.slice(0, 5).map((job) => {
                      const badgeConfig = statusBadgeMap[job.status] || { variant: "outline" as const };
                      return (
                        <div key={job.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {job.company} - {format(new Date(job.createdAt), "MMM d, yyyy")}
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
                    <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/35" />
                    <p className="text-sm text-muted-foreground">No jobs yet.</p>
                    <Button asChild variant="link" className="mt-1 text-primary">
                      <Link to="/jobs">Ingest your first job</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </ContentCard>
          </FadeIn>

          <FadeIn delay={0.3}>
            <ContentCard className="h-full border-primary/20 bg-primary/5">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Daily Inspiration</h3>
                  </div>
                  <p className="mb-3 text-sm italic leading-relaxed text-foreground">
                    "{INSPIRATIONAL_QUOTES[quoteIndex].quote}"
                  </p>
                  <p className="text-xs text-muted-foreground">- {INSPIRATIONAL_QUOTES[quoteIndex].author}</p>
                </div>
                <div className="mt-5 border-t border-border/70 pt-3">
                  <Link to="/resources" className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/85">
                    <BookOpen className="h-4 w-4" />
                    Free resources & support
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </ContentCard>
          </FadeIn>
        </div>
      )}
    </div>
  );
}
