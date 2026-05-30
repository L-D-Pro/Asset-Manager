import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { Plus, Sparkles, ChevronRight, Flame, Trophy } from "lucide-react";
import { CompanyMark } from "@/components/quiet/company-mark";
import { StatusChip } from "@/components/quiet/status-chip";
import { useAuth } from "@/context/auth";
import { useGamificationStats } from "@/hooks/use-gamification";
import { smartApi } from "@/lib/smart-ai-api";

interface ApplicationsStats {
  saved?: number;
  drafts?: number;
  submitted?: number;
  interviews?: number;
  offers?: number;
  deltas?: Record<string, string>;
}

interface Job {
  id: number;
  title: string;
  company?: string | null;
  location?: string | null;
  status?: string;
  fitScore?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

interface EventLog {
  id: number;
  eventType: string;
  entityType: string;
  entityId: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["applications", "stats"],
    queryFn: () => smartApi<ApplicationsStats>("/applications/stats"),
  });

  const { data: gam } = useGamificationStats();

  const { data: jobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => smartApi<Job[]>("/jobs"),
  });

  const { data: eventsResult } = useQuery({
    queryKey: ["event-logs", "limit-10"],
    queryFn: () => smartApi<{ rows: EventLog[]; nextCursor: string | null }>("/event-logs?limit=10"),
  });

  const greetName = user?.firstName ?? user?.username ?? "operator";
  const recentJobs = (jobs ?? []).slice(0, 5);

  const funnel = [
    { key: "saved", label: "Saved", value: stats?.saved ?? 0, delta: stats?.deltas?.saved ?? "", color: "cyan" },
    { key: "drafts", label: "In Draft", value: stats?.drafts ?? 0, delta: stats?.deltas?.drafts ?? "", color: "violet" },
    { key: "submitted", label: "Submitted", value: stats?.submitted ?? 0, delta: stats?.deltas?.submitted ?? "", color: "gold" },
    { key: "interviews", label: "Interviewing", value: stats?.interviews ?? 0, delta: stats?.deltas?.interviews ?? "", color: "pink", active: true },
    { key: "offers", label: "Offers", value: stats?.offers ?? 0, delta: stats?.deltas?.offers ?? "", color: "lime" },
  ];

  const xpPct =
    gam && gam.xpToNextLevel
      ? Math.round(Math.min(100, (gam.totalXp / gam.xpToNextLevel) * 100))
      : 0;

  const heatmapCells = Array.from({ length: 100 }, (_, i) => {
    const v = Math.floor((Math.sin(i * 0.7) + 1) * 2.2 + (i > 70 ? 1.2 : 0));
    return Math.max(0, Math.min(4, v));
  });

  return (
    <div className="page fade-up" style={{ paddingTop: 22 }}>
      {/* ── XP HERO ── */}
      <div className="xp-hero" style={{ marginBottom: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 22, alignItems: "center", position: "relative", zIndex: 1 }}>
          <div className="level-stamp">{gam?.currentLevel ?? 1}</div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · ARENA RANK</span>
              <span className="chip violet"><Trophy size={11} strokeWidth={1.8} /> DIAMOND LEAGUE</span>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 30, letterSpacing: "-0.025em", lineHeight: 1.05, color: "var(--ink)" }}>
              gm, {greetName}. <span style={{ color: "var(--accent)" }}>Three quests today.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                  <span className="label" style={{ color: "var(--gold)" }}>XP · Level {gam?.currentLevel ?? 1}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 700 }}>
                    {(gam?.totalXp ?? 0).toLocaleString()} <span style={{ color: "var(--ink-4)" }}>/ {(gam?.xpToNextLevel ?? 100).toLocaleString()}</span>
                  </span>
                </div>
                <div className="bar xp"><i style={{ width: `${xpPct}%` }} /></div>
                <div className="dim" style={{ fontSize: 11, marginTop: 5, fontWeight: 600 }}>
                  <span className="mono" style={{ color: "var(--gold)" }}>{(gam?.xpToNextLevel ?? 100) - (gam?.totalXp ?? 0)} XP</span> to Level {(gam?.currentLevel ?? 1) + 1}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <div className="streak-flame">
              <span className="flame-icon"><Flame size={18} strokeWidth={1.8} /></span>
              <span className="flame-num">{gam?.currentStreak ?? 0}</span>
              <span style={{ fontSize: 10, opacity: 0.85, marginLeft: -3, letterSpacing: "0.05em" }}>DAY</span>
            </div>
            <div className="energy">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`heart${i < 4 ? "" : " empty"}`}>
                  <Flame size={14} strokeWidth={1.8} />
                </span>
              ))}
              <span className="mono" style={{ fontSize: 11.5, marginLeft: 4, color: "var(--ink-2)" }}>4/5</span>
            </div>
            <span className="dim" style={{ fontSize: 10.5, fontWeight: 600 }}>
              refills in <span className="mono" style={{ color: "var(--ink-2)" }}>2h 14m</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Big CTAs ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <button className="btn primary lg" onClick={() => navigate("/chat")}>
          <Sparkles size={15} strokeWidth={1.8} /> Tailor next mission
          <span className="kbd">T</span>
        </button>
        <button className="btn gold lg" onClick={() => navigate("/claims")}>
          <Trophy size={15} strokeWidth={1.8} /> Verify 3 claims <span className="xp-chip" style={{ background: "rgba(0,0,0,0.25)", color: "#1A0F00", borderColor: "rgba(0,0,0,0.2)" }}>+120</span>
        </button>
        <button className="btn ghost lg" onClick={() => navigate("/jobs")}>
          <Plus size={14} strokeWidth={1.8} /> Add job
        </button>
        <div style={{ flex: 1 }} />
        <span className="hint"><Sparkles size={11} strokeWidth={1.8} /> 3.4x XP if you ship before midnight</span>
      </div>

      {/* ── Funnel ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 className="h-section">Pipeline <em>· season 02</em></h2>
        <span className="hint mono">7d ↑ +6 actions</span>
      </div>
      <div className="funnel" style={{ marginBottom: 26 }}>
        {funnel.map((c) => (
          <div
            className={`funnel-cell${c.active ? " active" : ""}`}
            key={c.key}
            onClick={() => navigate("/jobs")}
          >
            <span className="fn-label">{c.label}</span>
            <span className="fn-value">{c.value}</span>
            <span className={`fn-delta${c.delta?.startsWith("+") ? " up" : ""}`}>{c.delta || "\u2014 no change"}</span>
          </div>
        ))}
      </div>

      {/* ── 2-col body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Today's missions */}
          <div className="card">
            <div className="card-h">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 className="card-title">Today&apos;s <em>missions</em></h2>
                <span className="chip accent dot">3 active</span>
              </div>
              <button className="btn ghost sm">Customize</button>
            </div>
            <div>
              <MissionItem
                idx="01"
                title="Approve pending AI resume"
                meta="AI drafted recently · cites verified claims"
                cta="Review"
                reward={200}
                color="lime"
                primary
                onClick={() => navigate("/ai-review")}
              />
              <MissionItem
                idx="02"
                title="Check for recruiter replies"
                meta="Open chat threads to see responses"
                cta="Open chat"
                reward={80}
                color="cyan"
                onClick={() => navigate("/chat")}
              />
              <MissionItem
                idx="03"
                title="Verify unverified claims"
                meta="Unverified claims weaken AI citations · truth-lock"
                cta="Open ledger"
                reward={120}
                color="gold"
                onClick={() => navigate("/claims")}
                last
              />
            </div>
          </div>

          {/* Active arenas (recent jobs) */}
          <div className="card">
            <div className="card-h">
              <h2 className="card-title">Active <em>arenas</em></h2>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn ghost sm">Status</button>
                <Link to="/jobs" className="btn ghost sm">See all<ChevronRight size={13} strokeWidth={1.8} /></Link>
              </div>
            </div>
            <div className="row-list">
              {recentJobs.length === 0 && (
                <div className="dim" style={{ padding: "32px 18px", textAlign: "center" }}>
                  No jobs saved yet.{" "}
                  <Link to="/jobs" style={{ color: "var(--accent)", fontWeight: 800 }}>Add one</Link>.
                </div>
              )}
              {recentJobs.map((j) => (
                <div
                  className="row"
                  key={j.id}
                  style={{ gridTemplateColumns: "40px 1fr 110px 130px 70px 22px" }}
                  onClick={() => navigate(`/jobs/${j.id}`)}
                >
                  <CompanyMark name={j.company ?? j.title ?? "?"} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14 }}>{j.title}</div>
                    <div style={{ color: "var(--ink-3)", fontSize: 12, marginTop: 2, fontWeight: 600 }}>
                      {[j.company, j.location].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="mono dim" style={{ fontSize: 12 }}>{salaryRange(j.salaryMin, j.salaryMax)}</span>
                  <StatusChip status={j.status ?? "saved"} />
                  <FitBadge value={j.fitScore} />
                  <ChevronRight size={14} strokeWidth={1.8} />
                </div>
              ))}
            </div>
          </div>

          {/* Combat log (activity feed) */}
          <div className="card">
            <div className="card-h">
              <h2 className="card-title">Combat <em>log</em></h2>
              <span className="dim mono" style={{ fontSize: 11 }}>last 10 events</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8, paddingBottom: 14 }}>
              {(eventsResult?.rows ?? []).length === 0 && (
                <div className="dim" style={{ padding: "8px 0", fontSize: 13 }}>No recent activity.</div>
              )}
              {(eventsResult?.rows ?? []).map((t, i, arr) => {
                const isAi = t.eventType.startsWith("ai");
                return (
                  <div key={t.id} style={{ display: "grid", gridTemplateColumns: "92px 16px 1fr auto", gap: 12, padding: "9px 0", borderBottom: i === arr.length - 1 ? "none" : "1px dashed var(--line-soft)", alignItems: "center" }}>
                    <span className="mono dim" style={{ fontSize: 11, fontWeight: 600 }}>
                      {new Date(t.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span style={{
                      width: 8, height: 8, borderRadius: 99,
                      background: isAi ? "var(--accent)" : "var(--violet)",
                      boxShadow: `0 0 8px ${isAi ? "var(--accent-line)" : "var(--violet-line)"}`,
                    }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                      <span>{t.eventType}</span>
                      <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-4)" }}>{t.entityType}#{t.entityId}</span>
                    </div>
                    {isAi && <span className="chip violet" style={{ fontSize: 10 }}>AI</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Gamification rail ── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* League */}
          <div className="league-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "linear-gradient(135deg, var(--violet) 0%, #B9AAFF 100%)",
                display: "grid", placeItems: "center",
                color: "#FFF",
                boxShadow: "0 4px 0 var(--violet-deep), 0 0 18px rgba(142,125,255,0.5)",
                transform: "rotate(-6deg)",
              }}>
                <Trophy size={22} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label" style={{ color: "var(--violet)", marginBottom: 2 }}>League</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 900, letterSpacing: "-0.01em" }}>Diamond</div>
                <div className="dim" style={{ fontSize: 11.5, fontWeight: 600 }}>
                  Rank <span className="mono" style={{ color: "var(--ink-2)" }}>#4</span> of 30
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(142,125,255,0.20)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="dim" style={{ fontSize: 11.5, fontWeight: 700 }}>3 spots to promotion</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--violet)", fontWeight: 800 }}>4d left</span>
              </div>
              <div className="bar thin" style={{ background: "rgba(0,0,0,0.4)", borderColor: "var(--violet-line)" }}>
                <i style={{ width: "62%", background: "linear-gradient(90deg, var(--violet), #B9AAFF)", boxShadow: "0 0 10px var(--violet-line)" }} />
              </div>
            </div>
          </div>

          {/* Daily quests */}
          <div className="card">
            <div className="card-h">
              <h2 className="card-title" style={{ fontSize: 15 }}>Daily <em>quests</em></h2>
              <span className="dim mono" style={{ fontSize: 11 }}>{gam?.activeQuests?.length ?? 0} · resets 11h</span>
            </div>
            <div className="card-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {(gam?.activeQuests ?? []).length === 0 && (
                <div className="dim" style={{ fontSize: 12.5, textAlign: "center", padding: "12px 0" }}>
                  No active quests — pick one from the quests page.
                </div>
              )}
              {(gam?.activeQuests ?? []).slice(0, 4).map((q, i) => {
                const colors = ["lime", "pink", "gold", "cyan"];
                const c = colors[i % colors.length];
                return (
                  <div className={`quest ${c}`} key={q.id} onClick={() => navigate("/quests")}>
                    <div className="quest-title">{q.name}</div>
                    <div className="quest-desc">{q.description}</div>
                    <div className="bar thin" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <i style={{
                        width: `${q.criteriaValue ? Math.round(Math.min(100, (q.progress / q.criteriaValue) * 100)) : 0}%`,
                        background: `var(--${c})`,
                        boxShadow: `0 0 8px var(--${c}-line)`,
                      }} />
                    </div>
                    <div className="quest-foot">
                      <span className="mono"><span style={{ color: `var(--${c})` }}>{q.progress ?? 0}</span> / {q.criteriaValue ?? 1}</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className="xp-chip">+{q.xpReward ?? 0}</span>
                        <span className="dim">{q.frequency ?? "daily"}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trophy case */}
          <div className="card">
            <div className="card-h">
              <h2 className="card-title" style={{ fontSize: 15 }}>
                <Trophy size={14} strokeWidth={1.8} style={{ marginRight: 4 }} />Trophy <em>case</em>
              </h2>
              <button className="btn ghost sm">All</button>
            </div>
            <div className="card-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {(gam?.recentAchievements ?? []).length === 0 && (
                <div className="dim" style={{ fontSize: 12.5, textAlign: "center", padding: "12px 0" }}>
                  Earn achievements by reviewing AI output, applying to jobs, and verifying claims.
                </div>
              )}
              {(gam?.recentAchievements ?? []).slice(0, 5).map((a, i) => {
                const tones = ["lime", "gold", "pink", "cyan", "violet"];
                const tone = tones[i % tones.length];
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 10px", borderRadius: 10,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line-soft)",
                  }}>
                    <div className={`medal unlocked ${tone}`}>
                      <Trophy size={18} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>{a.name}</div>
                      <div className="dim" style={{ fontSize: 11, fontWeight: 600 }}>{a.description || "earned"}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--lime)", fontWeight: 800 }}>✓</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grind graph (heatmap) */}
          <div className="card">
            <div className="card-h">
              <h2 className="card-title" style={{ fontSize: 15 }}>Grind <em>graph</em></h2>
              <span className="dim mono" style={{ fontSize: 11 }}>100d</span>
            </div>
            <div className="card-body" style={{ padding: 14 }}>
              <div className="heatmap">
                {heatmapCells.map((v, i) => (
                  <div key={i} className={`heat-cell${v ? " l" + v : ""}`} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "var(--ink-4)", fontWeight: 700 }}>
                <span>less</span>
                <span className="mono" style={{ color: "var(--lime)" }}>{heatmapCells.filter((x) => x > 0).length} active days</span>
                <span>more</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MissionItem({
  idx,
  title,
  meta,
  cta,
  reward,
  color = "lime",
  primary,
  onClick,
  last,
}: {
  idx: string;
  title: string;
  meta: string;
  cta: string;
  reward: number;
  color?: string;
  primary?: boolean;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr auto auto",
        alignItems: "center",
        gap: 16,
        padding: "16px 18px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `var(--${color}-bg)`,
        border: `1px solid var(--${color}-line)`,
        color: `var(--${color})`,
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: 800, fontSize: 11, letterSpacing: "0.04em",
      }}>{idx}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{title}</div>
        <div className="dim" style={{ fontSize: 12, marginTop: 3, fontWeight: 600 }}>{meta}</div>
      </div>
      <span className="xp-chip">+{reward}</span>
      <button className={`btn ${primary ? "primary" : "ghost"} sm`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {cta} <ChevronRight size={11} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function FitBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="mono dim" style={{ fontSize: 13, textAlign: "center" }}>&mdash;</span>;
  const color = value >= 85 ? "var(--lime)" : value >= 70 ? "var(--cyan)" : value >= 55 ? "var(--gold)" : "var(--red)";
  const bg = value >= 85 ? "var(--lime-bg)" : value >= 70 ? "var(--cyan-bg)" : value >= 55 ? "var(--gold-bg)" : "var(--red-bg)";
  const line = value >= 85 ? "var(--lime-line)" : value >= 70 ? "var(--cyan-line)" : value >= 55 ? "var(--gold-line)" : "var(--red-line)";
  return (
    <span className="mono" style={{
      fontSize: 12, color, fontWeight: 900,
      textAlign: "center", fontVariantNumeric: "tabular-nums",
      background: bg, border: `1px solid ${line}`,
      padding: "3px 8px", borderRadius: 6,
      minWidth: 38,
    }}>
      {value}
    </span>
  );
}

function salaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "\u2014";
  const fmt = (n?: number | null) => (n ? `${Math.round(n / 1000)}k` : "?");
  if (min && max) return `$${fmt(min)}\u2013${fmt(max)}`;
  return `$${fmt(min ?? max)}`;
}
