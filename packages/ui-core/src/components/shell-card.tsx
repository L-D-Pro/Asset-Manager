import type { PropsWithChildren } from "react";

export function ShellCard({ children }: PropsWithChildren) {
  return <article className="ui-shell-card">{children}</article>;
}
