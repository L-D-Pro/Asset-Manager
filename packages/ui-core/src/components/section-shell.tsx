import type { PropsWithChildren } from "react";

export function SectionShell({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <section className="ui-section-shell">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
