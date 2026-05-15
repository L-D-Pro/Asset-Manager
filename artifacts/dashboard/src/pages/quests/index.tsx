import { useGamificationStats } from "@/hooks/use-gamification";
import { Icon } from "@/components/quiet/icon";

export default function QuestsPage() {
  const { data: gam, isLoading } = useGamificationStats();

  return (
    <div className="page fade-up">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <div>
          <h1 className="h-display">
            Quests <em>· keep the streak honest</em>
          </h1>
          <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>
            Small, recurring tasks that pay XP. Complete them to unlock achievements and
            keep the activity heatmap warm.
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="quiet-card" style={{ padding: 32, textAlign: "center" }}>
          <span className="dim">Loading…</span>
        </div>
      )}

      {gam && (
        <>
          {/* Stat strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 22,
            }}
          >
            <StatBlock label="Level" value={gam.currentLevel} />
            <StatBlock label="Total XP" value={gam.totalXp} />
            <StatBlock
              label="Streak"
              value={`${gam.currentStreak} day${gam.currentStreak === 1 ? "" : "s"}`}
              meta={`longest ${gam.longestStreak}`}
            />
            <StatBlock label="Achievements" value={gam.achievementsUnlocked} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22 }}>
            {/* Active quests */}
            <div className="quiet-card">
              <div className="quiet-card-header">
                <h2 className="quiet-card-title">Active quests</h2>
                <span className="dim mono" style={{ fontSize: 11 }}>
                  {gam.activeQuests.length}
                </span>
              </div>
              <div
                className="quiet-card-body"
                style={{
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {gam.activeQuests.length === 0 && (
                  <div className="dim" style={{ gridColumn: "1 / -1", padding: 10 }}>
                    No active quests right now.
                  </div>
                )}
                {gam.activeQuests.map((q) => (
                  <div className="quest" key={q.id}>
                    <div className="quest-title">{q.name}</div>
                    <div className="quest-desc">{q.description}</div>
                    <div className="bar" style={{ height: 4 }}>
                      <i
                        style={{
                          width: `${
                            q.criteriaValue
                              ? Math.min(100, (q.progress / q.criteriaValue) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="quest-foot">
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
            <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="quiet-card">
                <div className="quiet-card-header">
                  <h2 className="quiet-card-title" style={{ fontSize: 15 }}>
                    Achievements
                  </h2>
                  <span className="dim mono" style={{ fontSize: 11 }}>
                    {gam.recentAchievements.length}
                  </span>
                </div>
                <div
                  className="quiet-card-body"
                  style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {gam.recentAchievements.length === 0 && (
                    <div className="dim" style={{ fontSize: 12.5 }}>
                      Earn achievements by reviewing AI output, applying to jobs, and verifying claims.
                    </div>
                  )}
                  {gam.recentAchievements.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "var(--accent-bg)",
                          color: "var(--accent-ink)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Icon name="trophy" size={13} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.name}</div>
                        <div className="dim" style={{ fontSize: 11 }}>
                          {a.description}
                        </div>
                      </div>
                      <span className="mono dim" style={{ fontSize: 10.5 }}>
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
    <div className="quiet-card flat" style={{ padding: 14 }}>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
      {meta && (
        <div className="dim mono" style={{ fontSize: 11, marginTop: 6 }}>
          {meta}
        </div>
      )}
    </div>
  );
}
