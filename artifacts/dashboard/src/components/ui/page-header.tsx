import type { ReactNode } from "react";

/**
 * Legacy page header — re-skinned for Quiet Operations.
 *
 * The original component took a `variant` enum (hero | admin | data | workflow
 * | quiet) and rendered a glass-morphism card with a gradient hairline. All
 * variants now collapse into a single quiet treatment: an eyebrow line, a
 * Newsreader display title, an optional subtitle, and trailing actions.
 *
 * The full prop surface is preserved so existing call sites keep compiling
 * without code changes; the visual output is now consistent with the design
 * bundle's `.h-display` heading style.
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  badge?: ReactNode;
  /** Retained for compatibility — the visual treatment is the same regardless. */
  variant?: "hero" | "admin" | "data" | "workflow" | "quiet";
  /** @deprecated Visual gradients are gone; ignored. */
  gradient?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  children,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={className} style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 className="h-display">{title}</h1>
          {subtitle && (
            <p className="dim" style={{ fontSize: 13, marginTop: 6 }}>
              {subtitle}
            </p>
          )}
        </div>
        {children && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>
        )}
      </div>
      {badge && <div style={{ marginTop: 12 }}>{badge}</div>}
    </div>
  );
}
