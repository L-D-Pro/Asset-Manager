import { Link, useLocation } from "react-router-dom";

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
    <header>
      <div>
        <Link to="/dashboard">
          job-ops
        </Link>
        {crumbs.map((c, i) => (
          <span key={i}>
            {" / "}
            {c}
          </span>
        ))}
      </div>
      <div>
        <Link to="/chat">
          Run AI [Ctrl+J]
        </Link>
      </div>
    </header>
  );
}
