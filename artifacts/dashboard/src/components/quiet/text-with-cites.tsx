import { Fragment } from "react";

import { Cite } from "./cite";

/**
 * Renders text followed by inline `[N]` citation markers.
 *
 * For text that has citation markers embedded mid-string, see
 * {@link interleavedTextWithCites} below.
 */
export function TextWithCites({ text, cites = [] }: { text: string; cites?: number[] }) {
  if (!cites || cites.length === 0) return <>{text}</>;
  return (
    <>
      {text}{" "}
      {cites.map((id, i) => (
        <Fragment key={i}>
          <Cite id={id} />
          {i < cites.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Renders text with `[N]` citation markers replaced inline by hoverable Cite
 * components. The input string may look like:
 *
 *   "Led the migration to gRPC [12], shipped under 6 weeks [14]."
 *
 * Any `[123]` sequence is treated as a citation reference. Other text is
 * rendered as-is. Unknown ids still render (the hover card just shows a
 * loading state until the fetch resolves or fails).
 */
export function InterleavedTextWithCites({ text }: { text: string }) {
  const parts: Array<{ kind: "text"; value: string } | { kind: "cite"; id: number }> = [];
  let cursor = 0;
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) parts.push({ kind: "text", value: text.slice(cursor, m.index) });
    parts.push({ kind: "cite", id: Number(m[1]) });
    cursor = re.lastIndex;
  }
  if (cursor < text.length) parts.push({ kind: "text", value: text.slice(cursor) });

  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <Fragment key={i}>{p.value}</Fragment>
        ) : (
          <Cite key={i} id={p.id} />
        ),
      )}
    </>
  );
}
