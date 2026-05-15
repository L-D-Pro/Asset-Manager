import { Fragment } from "react";

import { Cite } from "./cite";

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
