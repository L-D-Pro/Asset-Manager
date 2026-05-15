import { NavLink, useLocation } from "react-router-dom";

import { Icon, type IconName } from "@/components/quiet/icon";
import { useAuth } from "@/context/auth";

/**
 * Quiet Operations sidebar.
 *
 * Adapted from `job-ops/project/app.jsx` (the Claude Design bundle). Five
 * primary destinations at the top, then collapsed-by-group nav for Insights,
 * AI ops, Settings, and (for admins only) Admin.
 *
 * Visually: warm paper (`.quiet-sidebar`), Newsreader serif brand mark, sage
 * accent for active items. No collapsible glass, no gradients.
 */

interface NavSpec {
  label: string;
  href: string;
  icon: IconName;
}

const PRIMARY_ITEMS: NavSpec[] = [
  { label: "Dashboard", href: "/dashboard", icon: "home" },
  { label: "Jobs", href: "/jobs", icon: "briefcase" },
  { label: "Claims", href: "/claims", icon: "claim" },
  { label: "Base resume", href: "/base-resume", icon: "resume" },
  { label: "Chat", href: "/chat", icon: "chat" },
];

const INSIGHTS_ITEMS: NavSpec[] = [
  { label: "Trends", href: "/trends", icon: "trend" },
  { label: "Job board", href: "/job-board", icon: "compass" },
  { label: "Quests", href: "/quests", icon: "trophy" },
];

const AI_OPS_ITEMS: NavSpec[] = [
  { label: "Review queue", href: "/ai-review", icon: "spark" },
  { label: "Prompt versions", href: "/ai-config", icon: "diff" },
  { label: "Models", href: "/ai-metrics", icon: "settings" },
];

const SETTINGS_ITEMS: NavSpec[] = [
  { label: "Account", href: "/account", icon: "shield" },
  { label: "Role profiles", href: "/role-profiles", icon: "users" },
  { label: "AI learning", href: "/ai-learning", icon: "graph" },
  { label: "Pipeline diagram", href: "/pipeline-diagram", icon: "diff" },
  { label: "Help & tips", href: "/guide", icon: "doc" },
];

const ADMIN_ITEMS: NavSpec[] = [
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Invite codes", href: "/admin/invite-codes", icon: "lock" },
  { label: "Usage limits", href: "/admin/usage-limits", icon: "graph" },
  { label: "UI shell", href: "/admin/ui-shell", icon: "settings" },
];

function isJobsActive(pathname: string): boolean {
  return (
    pathname === "/jobs" ||
    pathname.startsWith("/jobs/") ||
    pathname === "/resume-versions" ||
    pathname.startsWith("/resume-versions/") ||
    pathname === "/cover-letters" ||
    pathname.startsWith("/cover-letters/") ||
    pathname === "/applications" ||
    pathname.startsWith("/applications/") ||
    pathname === "/apply-wizard"
  );
}

interface NavRowProps {
  item: NavSpec;
  active: boolean;
}

function NavRow({ item, active }: NavRowProps) {
  return (
    <NavLink to={item.href} className={`nav-item ${active ? "active" : ""}`.trim()}>
      <span className="nav-icon">
        <Icon name={item.icon} size={15} />
      </span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export function FloatingSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const isAdmin = user?.role === "admin";

  const isActive = (href: string) => {
    if (href === "/jobs") return isJobsActive(path);
    if (href === "/dashboard") return path === "/dashboard";
    return path === href || path.startsWith(href + "/");
  };

  const initials = (user?.firstName?.[0] ?? user?.username?.[0] ?? "J").toUpperCase() +
    (user?.lastName?.[0] ?? "").toUpperCase();

  return (
    <aside
      className="quiet-sidebar"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "18px 14px 14px",
        gap: 18,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 0" }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: "var(--ink)",
            display: "grid",
            placeItems: "center",
            color: "var(--paper)",
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: 17,
            fontStyle: "italic",
            letterSpacing: "-0.02em",
          }}
        >
          J
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 400, letterSpacing: "-0.02em" }}>
          Job <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>Ops</em>
        </div>
      </div>

      <div
        className="quiet-scroll"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className="nav-group">
          {PRIMARY_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-label">Insights</div>
          {INSIGHTS_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-label">AI ops</div>
          {AI_OPS_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-label">Settings</div>
          {SETTINGS_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        {isAdmin && (
          <div className="nav-group">
            <div className="nav-label">Admin</div>
            {ADMIN_ITEMS.map((item) => (
              <NavRow key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: "var(--r)",
            border: "1px solid var(--line)",
            background: "var(--card)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--accent-bg)",
              color: "var(--accent-ink)",
              display: "grid",
              placeItems: "center",
              fontWeight: 500,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {initials || "J"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.username ?? "Operator"}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-4)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email ?? ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Sign out"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--ink-3)",
              padding: 4,
              borderRadius: "var(--r-sm)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
