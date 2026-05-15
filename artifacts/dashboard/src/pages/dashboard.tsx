import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { Icon } from "@/components/quiet/icon";
import { CompanyMark } from "@/components/quiet/company-mark";
import { StatusChip } from "@/components/quiet/status-chip";
import { useAuth } from "@/context/auth";
import { useGamificationStats } from "@/hooks/use-gamification";
import { smartApi } from "@/lib/smart-ai-api";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLine(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

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

  const { data: events } = useQuery({
    queryKey: ["event-logs", "limit-10"],
    queryFn: () => smartApi<EventLog[]>("/event-logs?limit=10"),
  });

  const greetName = user?.firstName ?? user?.username ?? "operator";
  const recentJobs = (jobs ?? []).slice(0, 5);

  const funnel = [
    { key: "saved", label: "Saved", value: stats?.saved ?? 0 },
    { key: "drafts", label: "In draft", value: stats?.drafts ?? 0 },
    { key: "submitted", label: "Submitted", value: stats?.submitted ?? 0 },
    { key: "interviews", label: "Interviewing", value: stats?.interviews ?? 0 },
    { key: "offers", label: "Offers", value: stats?.offers ?? 0 },
  ];

  return (
    <div className="page fade-up">
      {/* Greeting */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 26,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {todayLine()}
          </div>
          <h1 className="h-display">
            {greeting()}, {greetName}.{" "}
            <em>Three things today.</em>
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/jobs" className="btn">
            <Icon name="plus" size={14} />
            Add job
          </Link>
          <Link to="/chat" className="btn primary">
            <Icon name="spark" size={14} />
            Open copilot
          </Link>
        </div>
      </div>

      {/* Funnel */}
      <div className="funnel" style={{ marginBottom: 26 }}>
        {funnel.map((c) => (
          <div className="funnel-cell" key={c.key}>
            <span className="fn-label">{c.label}</span>
            <span className="fn-value">{c.value}</span>
            <span className="fn-delta">·</span>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Today's focus */}
          <div className="quiet-card">
            <div className="quiet-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 className="quiet-card-title">Today's focus</h2>
                <span className="chip accent dot">3 actions</span>
              </div>
            </div>
            <div>
              <FocusItem
                title="Review pending AI outputs"
                meta={
                  "Each pending_approval resume + cover letter waits for your explicit nod"
                }
                cta="Review queue"
                accent
                onClick={() => navigate("/ai-review")}
              />
              <FocusItem
                title="Tailor your next application"
                meta="Pick a job from the pipeline and let the copilot draft a tailored resume"
                cta="Pick a job"
                onClick={() => navigate("/jobs")}
              />
              <FocusItem
                title="Verify unverified claims"
                meta="Truth-lock — unverified claims weaken AI citations"
                cta="Open ledger"
                onClick={() => navigate("/claims")}
                last
              />
            </div>
          </div>

          {/* Recent jobs */}
          <div className="quiet-card">
            <div className="quiet-card-header">
              <h2 className="quiet-card-title">Recent jobs</h2>
              <Link to="/jobs" className="btn ghost">
                See all
                <Icon name="chev-r" size={13} />
              </Link>
            </div>
            <div>
              {recentJobs.length === 0 && (
                <div className="dim" style={{ padding: 18, fontSize: 13 }}>
                  No jobs saved yet.{" "}
                  <Link to="/jobs" style={{ color: "var(--accent)" }}>
                    Add one
                  </Link>
                  .
                </div>
              )}
              {recentJobs.map((j, i) => (
                <div
                  key={j.id}
                  onClick={() => navigate(`/jobs/${j.id}`)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr 110px 130px 70px 22px",
                    alignItems: "center",
                    gap: 14,
                    padding: "13px 18px",
                    borderBottom: i === recentJobs.length - 1 ? "none" : "1px solid var(--line-soft)",
                    cursor: "pointer",
                  }}
                >
                  <CompanyMark name={j.company ?? j.title ?? "?"} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "var(--ink)", fontSize: 14 }}>{j.title}</div>
                    <div style={{ color: "var(--ink-3)", fontSize: 12.5, marginTop: 2 }}>
                      {[j.company, j.location].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="mono dim" style={{ fontSize: 12 }}>
                    {salaryRange(j.salaryMin, j.salaryMax)}
                  </span>
                  <StatusChip status={j.status ?? "saved"} />
                  <FitBadge value={j.fitScore} />
                  <Icon name="chev-r" size={14} />
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="quiet-card">
            <div className="quiet-card-header">
              <h2 className="quiet-card-title">Recent activity</h2>
              <span className="dim mono" style={{ fontSize: 11 }}>
                last 10 events
              </span>
            </div>
            <div className="quiet-card-body" style={{ paddingTop: 6, paddingBottom: 14 }}>
              {(events ?? []).length === 0 && (
                <div className="dim" style={{ padding: 8, fontSize: 13 }}>
                  No recent activity.
                </div>
              )}
              {(events ?? []).map((t, i, arr) => (
                <div
                  key={t.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 14px 1fr",
                    gap: 12,
                    padding: "8px 0",
                    borderBottom: i === arr.length - 1 ? "none" : "1px dashed var(--line-soft)",
                  }}
                >
                  <span className="mono dim" style={{ fontSize: 11.5 }}>
                    {new Date(t.createdAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background:
                        t.eventType === "ai_call"
                          ? "var(--accent)"
                          : t.eventType === "ai_call_failed"
                          ? "var(--danger)"
                          : "var(--ink-3)",
                      marginTop: 7,
                    }}
                  />
                  <div style={{ fontSize: 13 }}>
                    <span>
                      <span className="mono" style={{ color: "var(--ink-2)" }}>
                        {t.eventType}
                      </span>{" "}
                      · {t.entityType}#{t.entityId}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gamification rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="xp-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span className="label">Level {gam?.currentLevel ?? 1}</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--accent-ink)" }}>
                {(gam?.totalXp ?? 0).toLocaleString()} /{" "}
                {(gam?.xpToNextLevel ?? 100).toLocaleString()} XP
              </span>
            </div>
            <div className="bar" style={{ background: "rgba(255,255,255,0.6)" }}>
              <i
                style={{
                  width: `${
                    gam && gam.xpToNextLevel
                      ? Math.min(100, (gam.totalXp / gam.xpToNextLevel) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 14,
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--warn)" }}>
                  <Icon name="flame" size={16} />
                </span>
                <span className="mono" style={{ fontSize: 13 }}>
                  {gam?.currentStreak ?? 0} day streak
                </span>
              </div>
              <span className="dim" style={{ fontSize: 12 }}>
                · longest {gam?.longestStreak ?? 0}
              </span>
            </div>
          </div>

          <div className="quiet-card">
            <div className="quiet-card-header">
              <h2 className="quiet-card-title" style={{ fontSize: 15 }}>
                Active quests
              </h2>
              <span className="dim mono" style={{ fontSize: 11 }}>
                {gam?.activeQuests.length ?? 0}
              </span>
            </div>
            <div
              className="quiet-card-body"
              style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
            >
              {(gam?.activeQuests ?? []).slice(0, 4).map((q) => (
                <div className="quest" key={q.id}>
                  <div className="quest-title">{q.name}</div>
                  <div className="quest-desc">{q.description}</div>
                  <div className="bar" style={{ height: 4 }}>
                    <i
                      style={{
                        width: `${
                          q.criteriaValue ? (q.progress / q.criteriaValue) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="quest-foot">
                    <span>
                      {q.progress} / {q.criteriaValue}
                    </span>
                    <span>+{q.xpReward} XP · {q.frequency}</span>
                  </div>
                </div>
              ))}
              {(gam?.activeQuests ?? []).length === 0 && (
                <Link to="/quests" className="dim" style={{ fontSize: 12.5, padding: 6 }}>
                  No active quests — pick one from the quests page.
                </Link>
              )}
            </div>
          </div>

          <div className="quiet-card">
            <div className="quiet-card-header">
              <h2 className="quiet-card-title" style={{ fontSize: 15 }}>
                Achievements
              </h2>
              <Link to="/quests" className="btn ghost" style={{ fontSize: 12 }}>
                All
              </Link>
            </div>
            <div
              className="quiet-card-body"
              style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
            >
              {(gam?.recentAchievements ?? []).slice(0, 5).map((a) => (
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
                </div>
              ))}
              {(gam?.recentAchievements ?? []).length === 0 && (
                <div className="dim" style={{ fontSize: 12.5, padding: 6 }}>
                  Earn achievements by reviewing AI output, applying to jobs, and verifying claims.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FocusItem({
  title,
  meta,
  cta,
  onClick,
  accent,
  last,
}: {
  title: string;
  meta: string;
  cta: string;
  onClick: () => void;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 99,
          background: accent ? "var(--accent)" : "var(--ink-4)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink)" }}>{title}</div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>
          {meta}
        </div>
      </div>
      <button
        type="button"
        className={`btn ${accent ? "accent" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ fontSize: 12 }}
      >
        {cta} <Icon name="chev-r" size={12} />
      </button>
    </div>
  );
}

function FitBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="dim mono" style={{ fontSize: 12 }}>—</span>;
  const color =
    value >= 85
      ? "var(--success)"
      : value >= 70
      ? "var(--accent)"
      : value >= 55
      ? "var(--warn)"
      : "var(--danger)";
  return (
    <span
      className="mono"
      style={{
        fontSize: 13,
        color,
        fontWeight: 500,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}

function salaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  const fmt = (n?: number | null) => (n ? `${Math.round(n / 1000)}k` : "?");
  if (min && max) return `$${fmt(min)}–${fmt(max)}`;
  return `$${fmt(min ?? max)}`;
}
