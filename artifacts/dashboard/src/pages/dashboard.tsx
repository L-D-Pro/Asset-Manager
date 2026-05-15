import { useGamificationStats } from "@/hooks/use-gamification";
import { XPCard } from "@/components/gamification/XPCard";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { GamifiedBadge } from "@/components/gamification/GamifiedBadge";
import { QuestCard } from "@/components/gamification/QuestCard";
import { LeaderboardStrip } from "@/components/gamification/LeaderboardStrip";
import { TiltCard } from "@/components/gamification/TiltCard";
import { MotivationalQuoteCard } from "@/components/gamification/MotivationalQuoteCard";
import { FloatingXP } from "@/components/gamification/FloatingXP";
import { SpeechBubble } from "@/components/gamification/SpeechBubble";
import { NextActions } from "@/components/dashboard/next-actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";
import { AlertTriangle, X } from "lucide-react";

function getGreeting(): string {
 const h = new Date().getHours();
 if (h < 12) return "Good morning!";
 if (h < 17) return "Good afternoon!";
 return "Good evening!";
}

const DEMO_ACHIEVEMENTS = [
 { name: "First Job", icon: "\uD83D\uDCCB", tier: "bronze" as const, unlocked: true },
 { name: "Resume Tailored", icon: "\u2702\uFE0F", tier: "silver" as const, unlocked: true },
 { name: "7 Day Streak", icon: "\uD83D\uDD25", tier: "gold" as const, unlocked: true },
 { name: "10 Apps Sent", icon: "\uD83D\uDCE8", tier: "silver" as const, unlocked: true },
 { name: "Interview Landed", icon: "\uD83C\uDFAF", tier: "gold" as const, unlocked: true },
 { name: "Cover Letter Pro", icon: "\uD83D\uDCDD", tier: "silver" as const, unlocked: false },
];

const containerVariants = {
 hidden: {},
 show: {
 transition: {
 staggerChildren: 0.08,
 },
 },
};

const itemVariants = {
 hidden: { opacity: 0, y: 24 },
 show: {
 opacity: 1,
 y: 0,
 transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
 },
};

function SkeletonRow() {
 return (
 <div className="flex flex-col gap-4">
 <Skeleton className="h-44 w-full rounded-[20px]" />
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Skeleton className="h-56 w-full rounded-[20px]" />
 <Skeleton className="h-56 w-full rounded-[20px]" />
 <Skeleton className="h-56 w-full rounded-[20px]" />
 </div>
 <div className="grid gap-4 md:grid-cols-3">
 {[1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-32 w-full rounded-2xl" />
 ))}
 </div>
 <Skeleton className="h-32 w-full rounded-[20px]" />
 <Skeleton className="h-24 w-full rounded-[20px]" />
 </div>
 );
}

interface ModelConfigHealthReport {
  healthy: boolean;
  unhealthyScopes: string[];
}

export default function Dashboard() {
 const { data: gStats, isLoading, isError, error } = useGamificationStats();
 const navigate = useNavigate();
 const { toast } = useToast();
 const { user } = useAuth();

 const [healthReport, setHealthReport] = useState<ModelConfigHealthReport | null>(null);
 const [healthDismissed, setHealthDismissed] = useState(false);

  const [floatingXp, setFloatingXp] = useState<Array<{ id: number; xp: number }>>([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    let cancelled = false;

    const fetchHealth = () => {
      fetch("/api/admin/health/model-configs", { credentials: "include" })
        .then((res) => {
          if (!res.ok) return;
          return res.json();
        })
        .then((data: unknown) => {
          if (cancelled || !data || typeof data !== "object") return;
          const report = data as Record<string, unknown>;
          if (typeof report.healthy !== "boolean") return;
          setHealthReport({
            healthy: report.healthy,
            unhealthyScopes: Array.isArray(report.unhealthyScopes)
              ? (report.unhealthyScopes as unknown[]).filter((s): s is string => typeof s === "string")
              : [],
          });
        })
        .catch(() => {});
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.role]);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now();
      setFloatingXp((prev) => [...prev, { id, xp: Math.floor(Math.random() * 5) + 1 }]);
      setTimeout(() => {
        setFloatingXp((prev) => prev.filter((f) => f.id !== id));
      }, 2500);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
 if (isError) {
 if (error instanceof Error && error.message !== "Failed to fetch gamification stats") {
 toast({
 title: "Couldn't load stats",
 description: error.message,
 variant: "destructive",
 });
 }
 }
 }, [isError, error, toast]);

 if (isLoading) {
 return <SkeletonRow />;
 }

 const greeting = getGreeting();
 const level = gStats?.currentLevel ?? 1;
 const currentLevelXp = gStats
 ? Math.max(0, gStats.totalXp - (gStats.currentLevel - 1) * (gStats.currentLevel - 1) * 100)
 : 0;
 const xpForNextLevel = gStats?.xpToNextLevel ?? 100;
 const totalXp = gStats?.totalXp ?? 0;
 const streak = gStats?.currentStreak ?? 0;

 const recentAchievements = gStats?.recentAchievements ?? [];
 const hasAchievements = recentAchievements.length > 0;

 return (
 <motion.div
 className="flex flex-col gap-5"
 variants={containerVariants}
 initial="hidden"
 animate="show"
 >
  {/* Admin: model config health warning */}
  {healthReport && !healthReport.healthy && !healthDismissed && (
    <motion.div variants={itemVariants}>
      <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-destructive">
            AI model config issue detected
          </p>
          <p className="text-sm text-muted-foreground">
            {healthReport.unhealthyScopes.length > 0
              ? `Unhealthy scopes: ${healthReport.unhealthyScopes.join(", ")}. `
              : ""}
            <Link to="/ai-config" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Go to AI Config to fix
            </Link>
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss warning"
          onClick={() => setHealthDismissed(true)}
          className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )}

  {/* Hero Strip */}
  <motion.div variants={itemVariants}>
    <TiltCard gradient="blue" className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      {/* Left: Greeting */}
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight gradient-text">
          {greeting}
        </h1>
      </div>

      {/* Right: Stat tiles */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Level */}
        <div className="flex flex-col items-center min-w-[80px] panel-glass px-5 py-4">
          <span className="text-3xl font-extrabold text-foreground tracking-tight">
            {level}
          </span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
            Level
          </span>
        </div>

        {/* Streak */}
        <div className="flex flex-col items-center min-w-[80px] panel-glass px-5 py-4">
          <span className="text-2xl">{"\uD83D\uDD25"}</span>
          <span className="text-xl font-extrabold text-foreground tracking-tight">
            {streak}
          </span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Day Streak
          </span>
        </div>

        {/* Total XP */}
        <div className="flex flex-col items-center min-w-[80px] panel-glass px-5 py-4">
          <span className="text-lg flex items-center gap-1 font-extrabold text-foreground tracking-tight">
            {"\u26A1"} {totalXp.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
            Total XP
          </span>
        </div>
      </div>
    </TiltCard>
  </motion.div>

  {/* Motivational Quote Card — 2nd card */}
  <motion.div variants={itemVariants}>
    <MotivationalQuoteCard />
  </motion.div>

  {/* Second Row: XP + Streak + Quick Action */}
  <motion.div
    variants={itemVariants}
    className="grid grid-cols-1 md:grid-cols-3 gap-5"
  >
    {/* Left: XPCard */}
    <TiltCard gradient="purple">
      <XPCard
        level={level}
        currentXp={currentLevelXp}
        xpToNext={xpForNextLevel}
        totalXp={totalXp}
      />
    </TiltCard>

    {/* Center: Streak card */}
    <TiltCard gradient="orange" className="flex flex-col items-center justify-center gap-4 p-6">
      <StreakFlame
        days={streak}
        className="!p-0 !shadow-none !border-none !bg-transparent !rounded-none"
      />
      <p className="text-sm font-semibold text-foreground">
        Keep it going!{" "}
        <span className="text-primary">{"\uD83D\uDD25"}</span>
      </p>
      {gStats && gStats.longestStreak > 0 && (
        <p className="text-xs text-muted-foreground">
          Longest streak: {gStats.longestStreak} days
        </p>
      )}
    </TiltCard>

    {/* Right: Quick action card */}
    <TiltCard gradient="blue" className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h3 className="text-lg font-bold text-foreground tracking-tight">
        Ready to apply?
      </h3>
      <div className="flex flex-col gap-3 w-full">
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={() => navigate("/apply-wizard")}
        >
          Start Applying
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => navigate("/jobs")}
        >
          Ingest a Job
        </Button>
      </div>
    </TiltCard>
  </motion.div>

  {/*********** Third Row: Next Actions ***********/}
 <motion.div variants={itemVariants}>
 <NextActions />
  </motion.div>

  {/* Quest Cards */}
  <motion.div variants={itemVariants}>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <QuestCard
        title="Tailor a Resume"
        description="Use the Apply Wizard"
        progress={0}
        reward="+50 XP"
        emoji="📄"
      />
      <QuestCard
        title="Review 3 Jobs"
        description="Check your pipeline"
        progress={0}
        reward="+30 XP"
        emoji="🔍"
      />
      <QuestCard
        title="Draft a Cover Letter"
        description="Stand out to employers"
        progress={0}
        reward="+40 XP"
        emoji="✍️"
      />
    </div>
  </motion.div>

  {/* Leaderboard */}
  <motion.div variants={itemVariants}>
    <LeaderboardStrip
      entries={[
        { name: "You", xp: totalXp, isYou: true },
        { name: "Alex", xp: Math.max(0, totalXp - 150) },
        { name: "Jordan", xp: Math.max(0, totalXp - 350) },
      ]}
    />
  </motion.div>

  {/* Fourth Row: Recent Achievements */}
  <motion.div variants={itemVariants} className="space-y-4">
    <h2 className="text-lg font-bold tracking-tight text-foreground">
      Recent Achievements
    </h2>

    {hasAchievements ? (
      <div className="flex flex-wrap gap-4">
        {recentAchievements.slice(0, 6).map((a) => (
          <GamifiedBadge
            key={a.id}
            name={a.name}
            icon={
              a.iconName === "trophy"
                ? "\uD83C\uDFC6"
                : a.iconName === "fire"
                ? "\uD83D\uDD25"
                : a.iconName === "star"
                ? "\u2B50"
                : "\uD83C\uDFAF"
            }
            tier={
              a.slug.includes("streak")
                ? "gold"
                : a.slug.includes("resume") || a.slug.includes("cover")
                ? "silver"
                : "bronze"
            }
            unlocked
            isNew={!a.seen}
          />
        ))}
      </div>
    ) : (
      <div className="card-glass flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">{"\uD83C\uDFC6"}</span>
        <p className="text-base font-semibold text-foreground">
          No achievements yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete actions to earn badges!
        </p>
      </div>
    )}
  </motion.div>

  {floatingXp.map((f) => (
    <FloatingXP key={f.id} xp={f.xp} />
  ))}
 </motion.div>
 );
}
