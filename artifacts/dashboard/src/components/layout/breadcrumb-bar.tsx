import { Link, useLocation } from "react-router-dom";

import { Icon } from "@/components/quiet/icon";

/**
 * Quiet Operations top breadcrumb bar.
 *
 * Sits above each page. Renders `job-ops / <crumb1> / <crumb2>` derived
 * directly from the current pathname segments. We don't use `useMatches`
 * here because the app uses the legacy `<BrowserRouter>`, not a data
 * router — that hook would throw at runtime.
 */

function humanise(segment: string): string {
  if (!segment) return "";
  if (segment === "ai-config") return "AI config";
  if (segment === "ai-review") return "Review queue";
  if (segment === "ai-learning") return "AI learning";
  if (segment === "ai-metrics") return "AI metrics";
  if (segment === "base-resume") return "Base resume";
  if (segment === "resume-versions") return "Resume review";
  if (segment === "cover-letters") return "Cover letters";
  if (segment === "apply-wizard") return "Apply";
  if (segment === "job-board") return "Job board";
  if (segment === "role-profiles") return "Role profiles";
  if (segment === "pipeline-diagram") return "Pipeline diagram";
  return segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function BreadcrumbBar() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const crumbs = segments.map(humanise);

  return (
    <header className="topbar">
      <div className="crumbs">
        <Link to="/dashboard" style={{ cursor: "pointer" }}>
          job-ops
        </Link>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <span className="sep">/</span>
            <span className={i === crumbs.length - 1 ? "here" : undefined}>{c}</span>
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          to="/chat"
          className="btn ghost"
          style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "5px 9px", fontSize: 12 }}
        >
          <Icon name="command" size={13} />
          Run AI
          <span
            className="kbd"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 5,
              background: "var(--paper-3)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            ⌘J
          </span>
        </Link>
      </div>
    </header>
  );
}
