import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { Plus, Sparkles, ChevronRight, Flame, Trophy } from "lucide-react";
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

  const xpPct =
    gam && gam.xpToNextLevel
      ? Math.round(Math.min(100, (gam.totalXp / gam.xpToNextLevel) * 100))
      : 0;

  return (
    <div>
      {/* Greeting */}
      <div>
        <div>
          <div>{todayLine()}</div>
          <h1>
            {greeting()}, {greetName}. <em>Three things today.</em>
          </h1>
        </div>
        <div>
          <Link to="/jobs">
            <Plus size={14} />
            {" "}Add job
          </Link>
          <Link to="/chat">
            <Sparkles size={14} />
            {" "}Open copilot
          </Link>
        </div>
      </div>

      {/* Funnel */}
      <div>
        {funnel.map((c) => (
          <div key={c.key}>
            <span>{c.label}</span>
            <span>{c.value}</span>
            <span>·</span>
          </div>
        ))}
      </div>

      {/* Body */}
      <div>
        <div>
          {/* Today's focus */}
          <div>
            <div>
              <div>
                <h2>Today&apos;s focus</h2>
                <span>3 actions</span>
              </div>
            </div>
            <div>
              <FocusItem
                title="Review pending AI outputs"
                meta="Each pending_approval resume + cover letter waits for your explicit nod"
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
          <div>
            <div>
              <h2>Recent jobs</h2>
              <Link to="/jobs">
                See all <ChevronRight size={13} />
              </Link>
            </div>
            <div>
              {recentJobs.length === 0 && (
                <div>
                  No jobs saved yet.{" "}
                  <Link to="/jobs">Add one</Link>.
                </div>
              )}
              {recentJobs.map((j, i) => (
                <div
                  key={j.id}
                  onClick={() => navigate(`/jobs/${j.id}`)}
                >
                  <CompanyMark name={j.company ?? j.title ?? "?"} />
                  <div>
                    <div>{j.title}</div>
                    <div>
                      {[j.company, j.location].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span>{salaryRange(j.salaryMin, j.salaryMax)}</span>
                  <StatusChip status={j.status ?? "saved"} />
                  <FitBadge value={j.fitScore} />
                  <ChevronRight size={14} />
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div>
            <div>
              <h2>Recent activity</h2>
              <span>last 10 events</span>
            </div>
            <div>
              {(events ?? []).length === 0 && (
                <div>No recent activity.</div>
              )}
              {(events ?? []).map((t, i, arr) => (
                <div key={t.id}>
                  <span>
                    {new Date(t.createdAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    {t.eventType === "ai_call"
                      ? "[AI]"
                      : t.eventType === "ai_call_failed"
                        ? "[ERR]"
                        : "[·]"}
                  </span>
                  <div>
                    <span>
                      {t.eventType}
                    </span>{" "}
                    · {t.entityType}#{t.entityId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gamification rail */}
        <aside>
          <div>
            <div>
              <span>Level {gam?.currentLevel ?? 1}</span>
              <span>
                {(gam?.totalXp ?? 0).toLocaleString()} /{" "}
                {(gam?.xpToNextLevel ?? 100).toLocaleString()} XP
              </span>
            </div>
            <div>
              XP Progress: {xpPct}%
            </div>
            <div>
              <div>
                <Flame size={16} />
                <span>{gam?.currentStreak ?? 0} day streak</span>
              </div>
              <span>· longest {gam?.longestStreak ?? 0}</span>
            </div>
          </div>

          <div>
            <div>
              <h2>Active quests</h2>
              <span>{gam?.activeQuests.length ?? 0}</span>
            </div>
            <div>
              {(gam?.activeQuests ?? []).slice(0, 4).map((q) => (
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
                    <span>+{q.xpReward} XP · {q.frequency}</span>
                  </div>
                </div>
              ))}
              {(gam?.activeQuests ?? []).length === 0 && (
                <Link to="/quests">
                  No active quests — pick one from the quests page.
                </Link>
              )}
            </div>
          </div>

          <div>
            <div>
              <h2>Achievements</h2>
              <Link to="/quests">All</Link>
            </div>
            <div>
              {(gam?.recentAchievements ?? []).slice(0, 5).map((a) => (
                <div key={a.id}>
                  <div>
                    <Trophy size={13} />
                  </div>
                  <div>
                    <div>{a.name}</div>
                    <div>{a.description}</div>
                  </div>
                </div>
              ))}
              {(gam?.recentAchievements ?? []).length === 0 && (
                <div>
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
    <div onClick={onClick}>
      <div />
      <div>
        <div>{title}</div>
        <div>{meta}</div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {cta} <ChevronRight size={12} />
      </button>
    </div>
  );
}

function FitBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span>—</span>;
  return <span>{value}</span>;
}

function salaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  const fmt = (n?: number | null) => (n ? `${Math.round(n / 1000)}k` : "?");
  if (min && max) return `$${fmt(min)}–${fmt(max)}`;
  return `$${fmt(min ?? max)}`;
}
