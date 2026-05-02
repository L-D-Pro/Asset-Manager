import type { PropsWithChildren } from "react";

export function GlassPanel({ children }: PropsWithChildren) {
  return <div className="ui-glass-panel">{children}</div>;
}
