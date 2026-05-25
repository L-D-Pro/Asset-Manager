import { useGamificationStats, useAchievements } from "@/hooks/use-gamification";
import { Plus } from "lucide-react";

const HEAT_CELLS = Array.from({ length: 100 }, (_, i) =>
  i % 7 === 0 ? 4 : i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0,
);

export default function QuestsPage() {
  const { data: gam, isLoading: gamLoading } = useGamificationStats();
  const { data: achievementsData, isLoading: achLoading } = useAchievements();

  const level = gam?.currentLevel ?? 1;
  const totalXp = gam?.totalXp ?? 0;
  const xpToNext = gam?.xpToNextLevel ?? 1000;
  const xpNext = totalXp + xpToNext;
  const streak = gam?.currentStreak ?? 0;
  const longestStreak = gam?.longestStreak ?? 0;
  const questsCompleted = gam?.questsCompleted ?? 0;
  const achievementsUnlocked = gam?.achievementsUnlocked ?? 0;
  const activeQuests = gam?.activeQuests ?? [];

  const allAchievements = achievementsData?.achievements ?? [];
  const unlockedSet = new Set((achievementsData?.unlocked ?? []).map((u) => u.achievementId));

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">level {level} · {totalXp.toLocaleString()} XP · {streak} day streak</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Quests <em>— momentum, kept.</em></h1>
        </div>
        <button className="btn primary" type="button">
          <Plus size={13} strokeWidth={1.8} /> Custom quest
        </button>
      </div>

      {/* Level bar / XP card */}
      <div className="xp-card" style={{ marginBottom: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 28, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span className="h-display" style={{ fontSize: 34, color: "var(--accent-ink)" }}>Level {level}</span>
              <span className="mono" style={{ fontSize: 13, color: "var(--accent-ink)" }}>
                {totalXp.toLocaleString()} / {xpNext.toLocaleString()} XP · {xpToNext.toLocaleString()} to level {level + 1}
              </span>
            </div>
            <div className="bar" style={{ height: 10, background: "rgba(255,255,255,0.5)" }}>
              <i style={{ width: `${Math.min(100, (totalXp / xpNext) * 100)}%` }} />
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 13, color: "var(--accent-ink)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--warn)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c0 0-6 6-6 12a6 6 0 0 0 12 0C18 8 12 2 12 2z"/></svg>
                </span>
                {streak} day streak
              </span>
              <span>· longest {longestStreak}</span>
              <span>· {questsCompleted} quests completed</span>
              <span>· {achievementsUnlocked} achievements</span>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8, color: "var(--accent-ink)" }}>Last 100 days</div>
            <div className="heatmap">
              {HEAT_CELLS.map((v, i) => <div key={i} className={`heat-cell${v ? " l" + v : ""}`} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Active quests grid */}
      <h2 className="h-section" style={{ marginBottom: 14 }}>Active <em>quests</em></h2>
      {gamLoading ? (
        <div className="dim" style={{ fontSize: 13, marginBottom: 32 }}>Loading…</div>
      ) : activeQuests.length === 0 ? (
        <div className="dim" style={{ fontSize: 13, marginBottom: 32 }}>No active quests. Accept one to start grinding.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 32 }}>
          {activeQuests.map((q) => {
            const pct = Math.min(100, q.criteriaValue > 0 ? (q.progress / q.criteriaValue) * 100 : 0);
            return (
              <div key={q.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, fontFamily: "var(--font-display)" }}>{q.name}</div>
                    <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>{q.description}</div>
                  </div>
                  <span className="chip accent dot" style={{ fontSize: 11, whiteSpace: "nowrap" }}>+{q.xpReward} XP</span>
                </div>
                <div className="bar" style={{ marginTop: 8 }}><i style={{ width: `${pct}%` }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                  <span>{q.progress} / {q.criteriaValue}</span>
                  <span>{q.frequency}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Achievements */}
      <h2 className="h-section" style={{ marginBottom: 14 }}>Achievements</h2>
      {achLoading ? (
        <div className="dim" style={{ fontSize: 13 }}>Loading…</div>
      ) : allAchievements.length === 0 ? (
        <div className="dim" style={{ fontSize: 13 }}>No achievements yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {allAchievements.map((a) => {
            const unlocked = unlockedSet.has(a.id);
            return (
              <div key={a.id} className="card" style={{
                padding: 18, textAlign: "center",
                opacity: unlocked ? 1 : 0.6,
                display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 99,
                  background: unlocked ? "var(--accent-bg)" : "var(--paper-3)",
                  color: unlocked ? "var(--accent-ink)" : "var(--ink-4)",
                  display: "grid", placeItems: "center",
                  border: "1px solid " + (unlocked ? "var(--accent-line)" : "var(--line)"),
                }}>
                  {unlocked ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.name}</div>
                <div className="dim" style={{ fontSize: 12, minHeight: 16 }}>{a.description}</div>
                <div className="mono dim" style={{ fontSize: 11 }}>{unlocked ? "✓ earned" : `${a.criteriaValue} needed`}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
