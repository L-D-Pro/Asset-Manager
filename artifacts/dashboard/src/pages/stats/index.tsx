import { useEffect, useState } from "react";
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
      <div>
        <h1>Stats</h1>
        <p>Your gamification journey</p>
        <p>Loading…</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div>
        <h1>Stats</h1>
        <p>Your gamification journey</p>
        <div>
          <Loader2 />
          <p>Unable to load stats</p>
          <p>Start using the app to earn XP!</p>
        </div>
      </div>
    );
  }

  const isNewUser = stats.totalXp === 0 && stats.currentLevel === 1;

  if (isNewUser) {
    return (
      <div>
        <h1>Stats</h1>
        <p>Your gamification journey</p>
        <div>
          <Trophy />
          <h2>Start your journey!</h2>
          <p>
            Start using the app to earn XP! Apply to jobs, tailor resumes, draft cover letters — every action earns points.
          </p>
        </div>
      </div>
    );
  }

  const levelProgress = stats.xpToNextLevel > 0
    ? Math.min(((stats.totalXp - ((stats.currentLevel - 1) * (stats.currentLevel - 1) * 100)) / stats.xpToNextLevel) * 100, 100)
    : 100;

  const unlockedIds = new Set((allAchievements?.unlocked ?? []).map((u: AchievementRecord) => u.achievementId ?? u.id));
  const mergedAchievements = (allAchievements?.achievements ?? []).map((a: AchievementRecord) => ({
    ...a,
    unlocked: unlockedIds.has(a.id),
  }));

  const maxXpInHistory = xpHistory.length > 0 ? Math.max(...xpHistory.map((h) => h.xpAmount), 1) : 1;

  return (
    <div>
      <h1>Stats</h1>
      <p>Your gamification journey</p>

      {/* Level + Streak Overview */}
      <div>
        <div>
          <h2>Level {stats.currentLevel}</h2>
          <div>
            Level Progress: {Math.round(levelProgress)}%
          </div>
          <div>
            <span>Level {stats.currentLevel}</span>
            <span>{stats.totalXp.toLocaleString()} XP total</span>
          </div>
          <div>
            {stats.xpToNextLevel.toLocaleString()} XP to level {stats.currentLevel + 1}
          </div>
        </div>

        <div>
          <h2>Streak: {stats.currentStreak} days</h2>
          <p>Longest streak: {stats.longestStreak}</p>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <div>
          <Trophy />
          <h2>Achievements</h2>
          <span>
            {stats.achievementsUnlocked} / {mergedAchievements.length} unlocked
          </span>
        </div>
        {mergedAchievements.length === 0 ? (
          <p>No achievements available yet.</p>
        ) : (
          <div>
            {mergedAchievements.map((a) => {
              const tierLabel =
                a.unlocked && a.slug.includes("master") ? "gold" :
                a.unlocked && a.slug.includes("streak") ? "gold" :
                a.unlocked ? "silver" :
                "bronze";
              const iconEmoji =
                a.iconName === "fire" ? "🔥" :
                a.iconName === "star" ? "⭐" :
                a.iconName === "brain" ? "🧠" :
                "🏆";
              const unlockedRecord = allAchievements?.unlocked?.find((u: AchievementRecord) => (u.achievementId ?? u.id) === a.id);
              const isNew = unlockedRecord && !unlockedRecord.seen;
              return (
                <div key={a.id ?? a.slug}>
                  <span>{iconEmoji}</span>
                  <div>
                    <div>{a.name} [{tierLabel}]</div>
                    <div>{a.description}</div>
                  </div>
                  {!a.unlocked && <span>Locked</span>}
                  {isNew && <span>New!</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* XP History */}
      <div>
        <div>
          <TrendingUp />
          <h2>Recent Activity</h2>
        </div>
        {xpHistory.length === 0 ? (
          <p>No activity yet.</p>
        ) : (
          <div>
            {xpHistory.slice(0, 12).map((item) => (
              <div key={item.id}>
                <span>
                  {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <div>
                  <div>
                    XP bar: {Math.round((item.xpAmount / maxXpInHistory) * 100)}%
                  </div>
                </div>
                <span>{actionLabel(item.actionType)}</span>
                <span>+{item.xpAmount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div>
        <div>
          <div>{stats.currentStreak}</div>
          <div>Day Streak</div>
        </div>
        <div>
          <div>{stats.longestStreak}</div>
          <div>Longest Streak</div>
        </div>
        <div>
          <div>{stats.questsCompleted}</div>
          <div>Quests Done</div>
        </div>
        <div>
          <div>{stats.achievementsUnlocked}</div>
          <div>Achievements</div>
        </div>
      </div>
    </div>
  );
}
