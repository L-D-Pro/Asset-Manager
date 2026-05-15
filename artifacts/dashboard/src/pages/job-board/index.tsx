import { useQuery } from "@tanstack/react-query";

import { smartApi } from "@/lib/smart-ai-api";
import { Icon } from "@/components/quiet/icon";
import { CompanyMark } from "@/components/quiet/company-mark";

interface BoardListing {
  id: number;
  externalId?: string;
  title: string;
  company: string;
  location?: string | null;
  remoteType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
  postedAt?: string | null;
  keywords?: string[] | null;
}

interface BoardSource {
  id: number;
  name: string;
  enabled: boolean;
  lastSyncedAt?: string | null;
  itemCount?: number | null;
}

export default function JobBoardPage() {
  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["job-board", "listings"],
    queryFn: async () => {
      try {
        return await smartApi<BoardListing[]>("/job-board");
      } catch {
        return [] as BoardListing[];
      }
    },
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["job-board", "sources"],
    queryFn: async () => {
      try {
        return await smartApi<BoardSource[]>("/job-board/sources");
      } catch {
        return [] as BoardSource[];
      }
    },
  });

  return (
    <div className="page fade-up">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <div>
          <h1 className="h-display">
            Job board <em>· aggregated leads</em>
          </h1>
          <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>
            Roles surfaced from configured sources. Save anything promising to the pipeline.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 22 }}>
        <div className="quiet-card">
          <div className="quiet-card-header">
            <h2 className="quiet-card-title">Listings</h2>
            <span className="dim mono" style={{ fontSize: 11 }}>
              {listings.length}
            </span>
          </div>
          <div>
            {listingsLoading && (
              <div className="dim" style={{ padding: 24, textAlign: "center" }}>
                Loading…
              </div>
            )}
            {!listingsLoading && listings.length === 0 && (
              <div className="dim" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>
                No listings yet. Configure a source to start ingesting.
              </div>
            )}
            {listings.map((l, i) => (
              <div
                key={l.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 130px 110px 22px",
                  gap: 14,
                  alignItems: "center",
                  padding: "13px 18px",
                  borderBottom:
                    i === listings.length - 1 ? "none" : "1px solid var(--line-soft)",
                  cursor: l.sourceUrl ? "pointer" : "default",
                }}
                onClick={() => {
                  if (l.sourceUrl) window.open(l.sourceUrl, "_blank");
                }}
              >
                <CompanyMark name={l.company} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{l.title}</div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {[l.company, l.location, l.remoteType].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="mono dim" style={{ fontSize: 12.5 }}>
                  {salaryRange(l.salaryMin, l.salaryMax)}
                </span>
                <span className="dim mono" style={{ fontSize: 12 }}>
                  {l.sourcePlatform ?? "—"}
                </span>
                <Icon name="ext" size={13} />
              </div>
            ))}
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="quiet-card">
            <div className="quiet-card-header">
              <h2 className="quiet-card-title" style={{ fontSize: 15 }}>
                Sources
              </h2>
            </div>
            <div className="quiet-card-body" style={{ padding: 12 }}>
              {sources.length === 0 && (
                <div className="dim" style={{ fontSize: 12.5 }}>
                  No sources configured yet.
                </div>
              )}
              {sources.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: s.enabled ? "var(--success)" : "var(--ink-4)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</div>
                    {s.lastSyncedAt && (
                      <div className="dim mono" style={{ fontSize: 11 }}>
                        synced {new Date(s.lastSyncedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {s.itemCount != null && (
                    <span className="mono dim" style={{ fontSize: 11 }}>
                      {s.itemCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function salaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  const fmt = (n?: number | null) => (n ? `${Math.round(n / 1000)}k` : "?");
  if (min && max) return `$${fmt(min)}–${fmt(max)}`;
  return `$${fmt(min ?? max)}`;
}
