import { useGamificationStats } from "@/hooks/use-gamification";
import { Trophy } from "lucide-react";

export default function QuestsPage() {
  const { data: gam, isLoading } = useGamificationStats();

  return (
    <div>
      <div>
        <div>
          <h1>
            Quests <em>· keep the streak honest</em>
          </h1>
          <div>
            Small, recurring tasks that pay XP. Complete them to unlock achievements and
            keep the activity heatmap warm.
          </div>
        </div>
      </div>

      {isLoading && (
        <div>Loading…</div>
      )}

      {gam && (
        <>
          {/* Stat strip */}
          <div>
            <StatBlock label="Level" value={gam.currentLevel} />
            <StatBlock label="Total XP" value={gam.totalXp} />
            <StatBlock
              label="Streak"
              value={`${gam.currentStreak} day${gam.currentStreak === 1 ? "" : "s"}`}
              meta={`longest ${gam.longestStreak}`}
            />
            <StatBlock label="Achievements" value={gam.achievementsUnlocked} />
          </div>

          <div>
            {/* Active quests */}
            <div>
              <div>
                <h2>Active quests</h2>
                <span>{gam.activeQuests.length}</span>
              </div>
              <div>
                {gam.activeQuests.length === 0 && (
                  <div>No active quests right now.</div>
                )}
                {gam.activeQuests.map((q) => (
                  <div key={q.id}>
                    <div>{q.name}</div>
                    <div>{q.description}</div>
                    <div>
                      Progress: {q.progress} / {q.criteriaValue} ({q.criteriaValue
                        ? Math.round(Math.min(100, (q.progress / q.criteriaValue) * 100))
                        : 0}%)
                    </div>
                    <div>
                      <span>
                        {q.progress} / {q.criteriaValue}
                      </span>
                      <span>
                        +{q.xpReward} XP · {q.frequency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <aside>
              <div>
                <div>
                  <h2>Achievements</h2>
                  <span>{gam.recentAchievements.length}</span>
                </div>
                <div>
                  {gam.recentAchievements.length === 0 && (
                    <div>
                      Earn achievements by reviewing AI output, applying to jobs, and verifying claims.
                    </div>
                  )}
                  {gam.recentAchievements.map((a) => (
                    <div key={a.id}>
                      <div>
                        <Trophy size={13} />
                      </div>
                      <div>
                        <div>{a.name}</div>
                        <div>{a.description}</div>
                      </div>
                      <span>
                        {new Date(a.unlockedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  meta,
}: {
  label: string;
  value: string | number;
  meta?: string;
}) {
  return (
    <div>
      <div>{label}</div>
      <div>{value}</div>
      {meta && <div>{meta}</div>}
    </div>
  );
}
