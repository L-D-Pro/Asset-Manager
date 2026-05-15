import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { smartApi } from "@/lib/smart-ai-api";

/**
 * Truth-lock citation marker.
 *
 * Renders an inline `[N]` chip. On hover, fetches the claim by id and shows
 * the source-of-truth panel: text, category, verified state, evidence type.
 *
 * The claim is fetched once per id and cached by TanStack Query so a page with
 * many cites only triggers as many requests as there are distinct claim ids.
 */

interface Claim {
  id: number;
  text: string;
  category?: string;
  verified?: boolean;
  evidenceType?: string;
  tags?: string[];
}

interface CiteProps {
  /** Claim id. The popover lazy-fetches `GET /claims/:id`. */
  id: number;
  /** Optional pre-loaded claim, skips the fetch. */
  claim?: Claim;
}

export function Cite({ id, claim: provided }: CiteProps) {
  const [open, setOpen] = useState(false);

  const { data: fetched } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => smartApi<Claim>(`/claims/${id}`),
    enabled: open && !provided,
    staleTime: 60_000,
  });

  const claim = provided ?? fetched;

  return (
    <span
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <a className="cite">[{id}]</a>
      {open && claim && (
        <div
          className="cite-pop show"
          style={{
            bottom: "100%",
            left: "50%",
            transform: "translate(-50%, -8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Claim · {claim.category ?? "uncategorized"}
            </span>
            <span className="cite-id">#{id}</span>
          </div>
          <div style={{ color: "var(--ink)", fontSize: 12.5, lineHeight: 1.5 }}>{claim.text}</div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className={`chip ${claim.verified ? "success" : "warn"} dot`}
              style={{ fontSize: 10.5 }}
            >
              {claim.verified ? "verified" : "unverified"}
            </span>
            {claim.evidenceType && (
              <span className="dim" style={{ fontSize: 11 }}>
                · {claim.evidenceType}
              </span>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
