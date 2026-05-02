import { useEffect, useState } from "react";
import { ProgressRing } from "@/components/gamification/ProgressRing";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { GamifiedBadge } from "@/components/gamification/GamifiedBadge";
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
      <div className="space-y-8 py-8">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-heading)] text-foreground">Stats</h1>
        <p className="text-muted text-lg">Your gamification journey</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-48 rounded-[20px]" />
          <Skeleton className="h-48 rounded-[20px]" />
          <Skeleton className="h-48 rounded-[20px]" />
          <Skeleton className="h-48 rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="py-8 space-y-8">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-heading)] text-foreground">Stats</h1>
        <div className="card-chunky flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-10 w-10 text-muted animate-spin mb-4" />
          <p className="text-foreground font-semibold text-lg">Unable to load stats</p>
          <p className="text-muted text-sm mt-1">Start using the app to earn XP!</p>
        </div>
      </div>
    );
  }

  const isNewUser = stats.totalXp === 0 && stats.currentLevel === 1;

  if (isNewUser) {
    return (
      <div className="py-8 space-y-8">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-heading)] text-foreground">Stats</h1>
        <p className="text-muted text-lg">Your gamification journey</p>
        <div className="card-chunky flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-16 w-16 text-muted opacity-40 mb-4" />
          <h2 className="text-xl font-bold text-foreground font-[family-name:var(--font-heading)]">Start your journey!</h2>
          <p className="text-muted text-sm mt-2 max-w-sm">
            Start using the app to earn XP! Apply to jobs, tailor resumes, draft cover letters — every action earns points.
          </p>
        </div>
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
    <div className="py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold font-[family-name:var(--font-heading)] text-foreground">Stats</h1>
        <p className="text-muted text-lg">Your gamification journey</p>
      </div>

      {/* Level + Streak Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-chunky flex flex-col items-center gap-4">
          <ProgressRing
            progress={levelProgress}
            size={140}
            strokeWidth={10}
            label={String(stats.currentLevel)}
          />
          <div className="w-full space-y-2">
            <div className="h-4 rounded-full bg-[hsl(var(--border))] overflow-hidden">
              <div
                className="h-full rounded-full gamify-gradient-primary transition-all duration-700"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Level {stats.currentLevel}</span>
              <span className="font-bold text-foreground">{stats.totalXp.toLocaleString()} XP total</span>
            </div>
            <div className="text-xs text-muted text-center">
              {(stats.totalXp - currentLevelXp).toLocaleString()} / {stats.xpToNextLevel.toLocaleString()} XP to level {stats.currentLevel + 1}
            </div>
          </div>
        </div>

        <StreakFlame days={stats.currentStreak} className="h-full justify-center" />
      </div>

      {/* Achievements */}
      <div className="card-chunky space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] text-foreground">
            Achievements
          </h2>
          <span className="text-sm text-muted">
            {stats.achievementsUnlocked} / {mergedAchievements.length} unlocked
          </span>
        </div>
        {mergedAchievements.length === 0 ? (
          <p className="text-sm text-muted">No achievements available yet.</p>
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
      </div>

      {/* XP History */}
      <div className="card-chunky space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] text-foreground">
            Recent Activity
          </h2>
        </div>
        {xpHistory.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {xpHistory.slice(0, 12).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted shrink-0 text-right">
                  {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
                <div className="flex-1">
                  <div className="h-5 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                    <div
                      className="h-full rounded-full gamify-gradient-primary transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(item.xpAmount / maxXpInHistory) * 100}%` }}
                    >
                      {item.xpAmount / maxXpInHistory > 0.2 && (
                        <span className="text-[10px] font-bold text-white">+{item.xpAmount}</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted w-28 shrink-0 truncate">{actionLabel(item.actionType)}</span>
                <span className="text-xs font-bold text-primary w-12 text-right shrink-0">+{item.xpAmount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-chunky text-center">
          <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">{stats.currentStreak}</p>
          <p className="text-xs text-muted">Day Streak</p>
        </div>
        <div className="card-chunky text-center">
          <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">{stats.longestStreak}</p>
          <p className="text-xs text-muted">Longest Streak</p>
        </div>
        <div className="card-chunky text-center">
          <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">{stats.questsCompleted}</p>
          <p className="text-xs text-muted">Quests Done</p>
        </div>
        <div className="card-chunky text-center">
          <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">{stats.achievementsUnlocked}</p>
          <p className="text-xs text-muted">Achievements</p>
        </div>
      </div>
    </div>
  );
}
