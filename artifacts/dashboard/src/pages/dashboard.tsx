import { useGamificationStats } from "@/hooks/use-gamification";
import { XPCard } from "@/components/gamification/XPCard";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { GamifiedBadge } from "@/components/gamification/GamifiedBadge";
import { NextActions } from "@/components/dashboard/next-actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

function getGreeting(): string {
 const h = new Date().getHours();
 if (h < 12) return "Good morning!";
 if (h < 17) return "Good afternoon!";
 return "Good evening!";
}

const INSPIRATIONAL_QUOTES = [
 { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
 { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
 { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
 { quote: "It is never too late to be what you might have been.", author: "George Eliot" },
 { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
 {
 quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
 author: "Winston Churchill",
 },
];

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

export default function Dashboard() {
 const { data: gStats, isLoading, isError, error } = useGamificationStats();
 const navigate = useNavigate();
 const { toast } = useToast();

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

 const quoteIdx = Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length);
 const quote = INSPIRATIONAL_QUOTES[quoteIdx];

 return (
 <motion.div
 className="flex flex-col gap-5"
 variants={containerVariants}
 initial="hidden"
 animate="show"
 >
 {/*********** Hero Strip ***********/}
 <motion.div variants={itemVariants}>
        <div className="bg-surface border-2 border-border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left: Greeting */}
              <div>
                <h1
                  className="text-3xl md:text-[32px] font-display font-extrabold text-foreground leading-tight"
                  style={{ fontFamily: "Nunito, sans-serif" }}
                >
 {greeting}
 </h1>
 </div>

 {/* Right: Stat tiles */}
 <div className="flex items-center gap-4 md:gap-8">
 {/* Level */}
 <div className="flex flex-col items-center min-w-[72px] bg-background rounded-2xl border border-border px-4 py-3">
              <span className="text-3xl font-extrabold font-display text-foreground">
                    {level}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
 Level
 </span>
 </div>

 {/* Streak */}
 <div className="flex flex-col items-center min-w-[72px] bg-background rounded-2xl border border-border px-4 py-3">
 <span className="text-3xl">{"\uD83D\uDD25"}</span>
                  <span className="text-xl font-extrabold font-display text-foreground">
                    {streak}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
 Day Streak
 </span>
 </div>

 {/* Total XP */}
 <div className="flex flex-col items-center min-w-[72px] bg-background rounded-2xl border border-border px-4 py-3">
                  <span className="text-2xl flex items-center gap-1 font-extrabold font-display text-foreground">
                    {"\u26A1"} {totalXp.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
 Total XP
 </span>
 </div>
 </div>
 </div>
 </motion.div>

 {/*********** Second Row: XP + Streak + Quick Action ***********/}
 <motion.div
 variants={itemVariants}
 className="grid grid-cols-1 md:grid-cols-3 gap-4"
 >
 {/* Left: XPCard */}
 <XPCard
 level={level}
 currentXp={currentLevelXp}
 xpToNext={xpForNextLevel}
 totalXp={totalXp}
 />

 {/* Center: Streak card */}
 <div className="card-chunky flex flex-col items-center justify-center gap-4">
 <StreakFlame
 days={streak}
 className="!p-0 !shadow-none !border-none !bg-transparent !rounded-none"
 />
 <p className="text-sm font-semibold text-foreground">
 Keep it going!{" "}
 <span className="text-accent">{"\uD83D\uDD25"}</span>
 </p>
 {gStats && gStats.longestStreak > 0 && (
 <p className="text-xs text-muted-foreground">
 Longest streak: {gStats.longestStreak} days
 </p>
 )}
 </div>

 {/* Right: Quick action card */}
 <div className="card-chunky flex flex-col items-center justify-center gap-4 text-center">
 <h3 className="text-lg font-display font-bold text-foreground">
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
 </div>
 </motion.div>

 {/*********** Third Row: Next Actions ***********/}
 <motion.div variants={itemVariants}>
 <NextActions />
 </motion.div>

 {/*********** Fourth Row: Recent Achievements ***********/}
 <motion.div variants={itemVariants} className="space-y-4">
 <h2 className="text-lg font-semibold tracking-tight text-foreground">
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
 <div className="card-chunky flex flex-col items-center justify-center py-12 text-center">
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

 {/*********** Bottom: Motivational Quote ***********/}
 <motion.div variants={itemVariants}>
 <div className="bg-surface card-chunky text-center flex flex-col items-center gap-2">
 <p className="text-base italic leading-relaxed text-muted-foreground max-w-lg">
 &ldquo;{quote.quote}&rdquo;
 </p>
 <p className="text-xs text-muted-foreground">&mdash; {quote.author}</p>
 </div>
 </motion.div>
 </motion.div>
 );
}
