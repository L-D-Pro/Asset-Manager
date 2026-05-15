import type { ReactNode } from "react";

/**
 * Quiet Operations page shell.
 *
 * Replaces the old glass-morphism `<PageHeader />` with the design bundle's
 * h-display heading layout. Pages should wrap their primary content in this:
 *
 *   <PageShell title="Jobs" eyebrow="02 Pipeline" subtitle="…" actions={…}>
 *     {content}
 *   </PageShell>
 *
 * `title` supports `<em>` tags for italic-display emphasis (matches the design
 * pattern e.g. "Claims · truth-lock ledger").
 */
interface PageShellProps {
  title: ReactNode;
  /** Above-the-title hint (typically the screen number / category). */
  eyebrow?: ReactNode;
  /** One-sentence framing under the title. */
  subtitle?: ReactNode;
  /** Right-edge actions (buttons, kbd hints). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageShell({
  title,
  eyebrow,
  subtitle,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={`page fade-up ${className ?? ""}`.trim()}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
          <h1 className="h-display">{title}</h1>
          {subtitle && (
            <div className="dim" style={{ fontSize: 13, marginTop: 6 }}>
              {subtitle}
            </div>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
