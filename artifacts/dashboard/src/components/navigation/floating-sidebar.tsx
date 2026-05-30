import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import {
  Home,
  Briefcase,
  ShieldCheck,
  FileText,
  Mail,
  MessageSquare,
  Search,
  TrendingUp,
  Compass,
  Trophy,
  Sparkles,
  GitCompare,
  Users,
  Key,
  Gauge,
  ClipboardCheck,
  SlidersHorizontal,
  RotateCcw,
  Gamepad2,
  ChevronRight,
  Layers,
  Settings,
  GitBranch,
} from "lucide-react";
import { ProfileCard, useProfile } from "./profile-card";

function isAdvanceActive(pathname: string): boolean {
  return (
    pathname === "/jobs" ||
    pathname.startsWith("/jobs/") ||
    pathname === "/claims" ||
    pathname === "/base-resume" ||
    pathname === "/cover-letters" ||
    pathname.startsWith("/cover-letters/") ||
    pathname === "/resume-versions" ||
    pathname.startsWith("/resume-versions/") ||
    pathname === "/applications" ||
    pathname.startsWith("/applications/") ||
    pathname === "/apply-wizard"
  );
}

function isInsightsActive(pathname: string): boolean {
  return pathname === "/trends" || pathname === "/job-board" || pathname === "/quests";
}

function isAiOpsActive(pathname: string): boolean {
  return pathname === "/ai-review" || pathname === "/ai-config";
}

function isAdminActive(pathname: string): boolean {
  return pathname.startsWith("/admin/") || pathname === "/pipeline-diagram" || pathname === "/ai-metrics";
}

export function FloatingSidebar() {
  const { user } = useAuth();
  const [profile] = useProfile();
  const location = useLocation();
  const path = location.pathname;
  const [profileOpen, setProfileOpen] = useState(false);
  const userCardRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === "/dashboard") return path === "/dashboard" || path === "/";
    return path === href || path.startsWith(href + "/");
  };

  const level = 1;
  const xp = 0;
  const xpNext = 1000;

  const displayName = profile.name !== DEFAULT_PROFILE_NAME
    ? profile.name
    : user?.firstName
      ? `${user.firstName} ${user.lastName ?? ""}`.trim()
      : user?.username ?? "Job Ops User";

  const initials = displayName
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "JO";

  return (
    <div className="sidebar">
      <Link to="/dashboard" className="brand">
        <div className="brand-mark">J</div>
        <div className="brand-name">job<em>ops</em></div>
      </Link>

      <div className="search" style={{ minWidth: 0 }}>
        <Search size={13} strokeWidth={1.8} />
        <input placeholder="Search anything…" />
        <span className="kbd">&#x2318;K</span>
      </div>

      <div className="nav-group">
        <NavItem icon={<Home size={15} />} label="Dashboard" active={isActive("/dashboard")} href="/dashboard" />
        <NavItem icon={<MessageSquare size={15} />} label="Chat" active={isActive("/chat")} href="/chat" />
      </div>

      <div className="nav-group">
        <CollapsibleGroup
          icon={<Layers size={15} />}
          label="Advance"
          defaultOpen={isAdvanceActive(path)}>
          <NavItem icon={<Briefcase size={15} />} label="Jobs" active={isActive("/jobs")} href="/jobs" indent />
          <NavItem icon={<ShieldCheck size={15} />} label="Claims" active={isActive("/claims")} href="/claims" indent />
          <NavItem icon={<FileText size={15} />} label="Base resume" active={isActive("/base-resume")} href="/base-resume" indent />
          <NavItem icon={<Mail size={15} />} label="Cover letters" active={isActive("/cover-letters")} href="/cover-letters" indent />
        </CollapsibleGroup>

        <CollapsibleGroup
          icon={<TrendingUp size={15} />}
          label="Insights"
          defaultOpen={isInsightsActive(path)}>
          <NavItem icon={<TrendingUp size={15} />} label="Trends" active={isActive("/trends")} href="/trends" indent />
          <NavItem icon={<Compass size={15} />} label="Job board" active={isActive("/job-board")} href="/job-board" indent />
          <NavItem icon={<Trophy size={15} />} label="Quests" active={isActive("/quests")} href="/quests" indent />
        </CollapsibleGroup>

        <CollapsibleGroup
          icon={<Sparkles size={15} />}
          label="AI ops"
          defaultOpen={isAiOpsActive(path)}>
          <NavItem icon={<Sparkles size={15} />} label="Review queue" active={isActive("/ai-review")} href="/ai-review" indent />
          <NavItem icon={<GitCompare size={15} />} label="Prompt versions" active={isActive("/ai-config")} href="/ai-config" indent />
        </CollapsibleGroup>

        {user?.role === "admin" && (
          <CollapsibleGroup
            icon={<Settings size={15} />}
            label="Settings"
            defaultOpen={isAdminActive(path)}>
            <NavItem icon={<Gamepad2 size={15} />} label="Models" active={isActive("/ai-metrics")} href="/ai-metrics" indent />
            <NavItem icon={<Users size={15} />} label="Users" active={isActive("/admin/users")} href="/admin/users" indent />
            <NavItem icon={<Key size={15} />} label="Invite codes" active={isActive("/admin/invite-codes")} href="/admin/invite-codes" indent />
            <NavItem icon={<Gauge size={15} />} label="Usage limits" active={isActive("/admin/usage-limits")} href="/admin/usage-limits" indent />
            <NavItem icon={<GitBranch size={15} />} label="Pipeline Hub" active={isActive("/pipeline-diagram")} href="/pipeline-diagram" indent />
            <NavItem icon={<ClipboardCheck size={15} />} label="Best practices" active={isActive("/admin/best-practices")} href="/admin/best-practices" indent />
            <NavItem icon={<SlidersHorizontal size={15} />} label="AI Control Plane" active={isActive("/admin/ai-control-plane")} href="/admin/ai-control-plane" indent />
            <NavItem icon={<RotateCcw size={15} />} label="Reset" active={isActive("/admin/reset")} href="/admin/reset" indent />
          </CollapsibleGroup>
        )}
      </div>

      <div className="sidebar-bottom">
        <div
          ref={userCardRef}
          className={`user-card${profileOpen ? " open" : ""}`}
          onClick={() => setProfileOpen(o => !o)}
          role="button"
          aria-label="Open profile">
          <div className="avatar" style={{
            background: `linear-gradient(135deg, oklch(0.5 0.18 ${profile.avatarHue}) 0%, oklch(0.4 0.14 ${(profile.avatarHue + 140) % 360}) 100%)`,
          }}>
            {initials}
          </div>
          <div className="user-meta">
            <span className="user-name">{displayName}</span>
            <span className="user-email">LVL {level} · {xp.toLocaleString()} XP</span>
          </div>
          <div style={{ marginLeft: "auto", color: "var(--ink-4)", display: "flex" }}>
            <ChevronRight size={14} strokeWidth={2} />
          </div>
        </div>

        <ProfileCard
          open={profileOpen}
          anchorRef={userCardRef}
          onClose={() => setProfileOpen(false)}
          level={level}
          xp={xp}
          xpNext={xpNext}
        />

        <div className="sidebar-footer-links">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_PROFILE_NAME = "Job Ops User";

function CollapsibleGroup({
  icon,
  label,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        className="nav-item"
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span className="nav-icon">{icon}</span>
        <span>{label}</span>
        <ChevronRight
          size={13}
          strokeWidth={2}
          style={{
            marginLeft: "auto",
            color: "var(--ink-4)",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        />
      </button>
      {open && (
        <div style={{ paddingLeft: 10, marginTop: 2 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  href,
  indent = false,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  href: string;
  indent?: boolean;
  count?: number;
}) {
  return (
    <Link
      to={href}
      className={`nav-item${active ? " active" : ""}${indent ? " nav-item-indent" : ""}`}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {count != null && <span className="nav-count">{count}</span>}
    </Link>
  );
}
