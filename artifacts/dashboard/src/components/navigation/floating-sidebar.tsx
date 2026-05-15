import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";

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

export function FloatingSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  const isActive = (href: string) => {
    if (href === "/jobs") return isJobsActive(path);
    if (href === "/dashboard") return path === "/dashboard";
    return path === href || path.startsWith(href + "/");
  };

  const initials = (user?.firstName?.[0] ?? user?.username?.[0] ?? "J").toUpperCase() +
    (user?.lastName?.[0] ?? "").toUpperCase();

  return (
    <nav>
      <Link to="/">Job Ops</Link>
      <ul>
        <li><Link to="/dashboard">Dashboard</Link></li>
        <li><Link to="/jobs">Jobs</Link></li>
        <li><Link to="/claims">Claims</Link></li>
        <li><Link to="/base-resume">Base Resume</Link></li>
        <li><Link to="/chat">Chat</Link></li>
      </ul>
      <ul>
        <li><Link to="/trends">Trends</Link></li>
        <li><Link to="/job-board">Job Board</Link></li>
        <li><Link to="/quests">Quests</Link></li>
      </ul>
      <ul>
        <li><Link to="/ai-review">Review Queue</Link></li>
        <li><Link to="/ai-config">Prompt Versions</Link></li>
        <li><Link to="/ai-metrics">Models</Link></li>
      </ul>
      <ul>
        <li><Link to="/account">Account</Link></li>
        <li><Link to="/role-profiles">Role Profiles</Link></li>
        <li><Link to="/ai-learning">AI Learning</Link></li>
        <li><Link to="/pipeline-diagram">Pipeline Diagram</Link></li>
        <li><Link to="/guide">Help &amp; Tips</Link></li>
      </ul>
      {user?.role === "admin" && (
        <ul>
          <li><Link to="/admin/users">Users</Link></li>
          <li><Link to="/admin/invite-codes">Invite Codes</Link></li>
          <li><Link to="/admin/usage-limits">Usage Limits</Link></li>
          <li><Link to="/admin/ui-shell">UI Shell</Link></li>
        </ul>
      )}
      <div>
        <span>{initials}</span>
        <button onClick={() => logout()}>Logout</button>
      </div>
    </nav>
  );
}
