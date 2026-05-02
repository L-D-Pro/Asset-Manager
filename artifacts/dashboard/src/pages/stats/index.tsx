import { useEffect, useState } from "react";
import { ProgressRing } from "@/components/gamification/ProgressRing";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { GamifiedBadge } from "@/components/gamification/GamifiedBadge";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, Loader2 } from "lucide-react";

interface GamificationStats {
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  xpToNextLevel: number;
  questsCompleted: number;
  achievementsUnlocked: number;
}

interface XpHistoryItem {
  id: number;
  actionType: string;
  xpAmount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AchievementRecord {
  id?: number;
  achievementId?: number;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  unlockedAt?: string;
  seen?: boolean;
}

function actionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    job_apply: "Applied to job",
    wizard_complete: "Completed wizard",
    resume_tailor: "Tailored resume",
    cover_letter: "Drafted cover letter",
    compare: "Compared models",
    ai_visit: "Visited AI tools",
    daily_login: "Daily login",
  };
  return labels[actionType] ?? actionType.replace(/_/g, " ");
}

export default function StatsPage() {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [xpHistory, setXpHistory] = useState<XpHistoryItem[]>([]);
  const [allAchievements, setAllAchievements] = useState<{ achievements: AchievementRecord[]; unlocked: AchievementRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, xpRes, achRes] = await Promise.all([
          fetch("/api/gamification/stats", { credentials: "include" }),
          fetch("/api/gamification/xp/history?limit=20", { credentials: "include" }),
          fetch("/api/gamification/achievements", { credentials: "include" }),
        ]);

        if (!cancelled) {
          if (statsRes.ok) setStats(await statsRes.json());
          if (xpRes.ok) {
            const xpData = await xpRes.json() as { items: XpHistoryItem[] };
            setXpHistory(xpData.items ?? []);
          }
          if (achRes.ok) setAllAchievements(await achRes.json());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stats" subtitle="Your gamification journey" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stats" subtitle="Your gamification journey" />
        <ContentCard className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mb-4" />
          <p className="text-foreground font-semibold text-lg">Unable to load stats</p>
          <p className="text-muted-foreground text-sm mt-1">Start using the app to earn XP!</p>
        </ContentCard>
      </div>
    );
  }

  const isNewUser = stats.totalXp === 0 && stats.currentLevel === 1;

  if (isNewUser) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stats" subtitle="Your gamification journey" />
        <ContentCard className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-16 w-16 text-muted-foreground opacity-40 mb-4" />
          <h2 className="text-xl font-bold text-foreground">Start your journey!</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm">
            Start using the app to earn XP! Apply to jobs, tailor resumes, draft cover letters — every action earns points.
          </p>
        </ContentCard>
      </div>
    );
  }

  const currentLevelXp = stats.totalXp - (stats.xpToNextLevel - (stats.totalXp % (stats.totalXp - stats.xpToNextLevel + stats.xpToNextLevel)) || 0);
  const levelProgress = stats.xpToNextLevel > 0
    ? Math.min(((stats.totalXp - ((stats.currentLevel - 1) * (stats.currentLevel - 1) * 100)) / stats.xpToNextLevel) * 100, 100)
    : 100;

  const unlockedIds = new Set((allAchievements?.unlocked ?? []).map((u: any) => u.achievementId ?? u.id));
  const mergedAchievements = (allAchievements?.achievements ?? []).map((a: any) => ({
    ...a,
    unlocked: unlockedIds.has(a.id),
  }));

  const maxXpInHistory = xpHistory.length > 0 ? Math.max(...xpHistory.map((h) => h.xpAmount), 1) : 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Stats" subtitle="Your gamification journey" />

      {/* Level + Streak Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <ContentCard className="flex flex-col items-center gap-4">
          <ProgressRing
            progress={levelProgress}
            size={140}
            strokeWidth={10}
            label={String(stats.currentLevel)}
          />
          <div className="w-full space-y-2">
            <div className="h-4 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${levelProgress}%`,
                  background: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Level {stats.currentLevel}</span>
              <span className="font-bold text-foreground">{stats.totalXp.toLocaleString()} XP total</span>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {(stats.totalXp - currentLevelXp).toLocaleString()} / {stats.xpToNextLevel.toLocaleString()} XP to level {stats.currentLevel + 1}
            </div>
          </div>
        </ContentCard>

        <ContentCard className="flex items-center justify-center">
          <StreakFlame days={stats.currentStreak} />
        </ContentCard>
      </div>

      {/* Achievements */}
      <ContentCard>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Achievements
          </h2>
          <span className="text-sm text-muted-foreground">
            {stats.achievementsUnlocked} / {mergedAchievements.length} unlocked
          </span>
        </div>
        {mergedAchievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No achievements available yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mergedAchievements.map((a) => {
              const tier =
                a.unlocked && a.slug.includes("master") ? "gold" as const :
                a.unlocked && a.slug.includes("streak") ? "gold" as const :
                a.unlocked ? "silver" as const :
                "bronze" as const;
              const unlockedRecord = allAchievements?.unlocked?.find((u: any) => (u.achievementId ?? u.id) === a.id);
              return (
                <GamifiedBadge
                  key={a.id ?? a.slug}
                  name={a.name}
                  icon={a.iconName === "fire" ? "🔥" : a.iconName === "star" ? "⭐" : a.iconName === "brain" ? "🧠" : "🏆"}
                  tier={tier}
                  unlocked={a.unlocked}
                  isNew={unlockedRecord && !unlockedRecord.seen}
                />
              );
            })}
          </div>
        )}
      </ContentCard>

      {/* XP History */}
      <ContentCard>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Recent Activity
          </h2>
        </div>
        {xpHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {xpHistory.slice(0, 12).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted-foreground shrink-0 text-right">
                  {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
                <div className="flex-1">
                  <div className="h-5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(item.xpAmount / maxXpInHistory) * 100}%` }}
                    >
                      {item.xpAmount / maxXpInHistory > 0.2 && (
                        <span className="text-[10px] font-bold text-primary-foreground">+{item.xpAmount}</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{actionLabel(item.actionType)}</span>
                <span className="text-xs font-bold text-primary w-12 text-right shrink-0">+{item.xpAmount}</span>
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ContentCard className="text-center py-5">
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{stats.currentStreak}</p>
          <p className="text-xs text-muted-foreground mt-1">Day Streak</p>
        </ContentCard>
        <ContentCard className="text-center py-5">
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{stats.longestStreak}</p>
          <p className="text-xs text-muted-foreground mt-1">Longest Streak</p>
        </ContentCard>
        <ContentCard className="text-center py-5">
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{stats.questsCompleted}</p>
          <p className="text-xs text-muted-foreground mt-1">Quests Done</p>
        </ContentCard>
        <ContentCard className="text-center py-5">
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{stats.achievementsUnlocked}</p>
          <p className="text-xs text-muted-foreground mt-1">Achievements</p>
        </ContentCard>
      </div>
    </div>
  );
}