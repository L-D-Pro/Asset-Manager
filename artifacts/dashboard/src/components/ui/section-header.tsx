import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/quiet/icon";

/**
 * Legacy section header — re-skinned for Quiet Operations.
 *
 * Newsreader display title (smaller than `h-display`), optional muted
 * description, optional action link with a trailing chevron. API preserved.
 */
interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div style={{ minWidth: 0 }}>
        <h2 className="h-section">{title}</h2>
        {description && (
          <p className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link
          to={action.href}
          className="btn ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 9px",
            fontSize: 12.5,
            color: "var(--ink-2)",
            transition: "color 0.12s",
          }}
        >
          {action.label}
          <Icon name="chev-r" size={13} />
        </Link>
      )}
    </div>
  );
}
