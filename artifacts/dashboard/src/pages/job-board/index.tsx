import { useQuery } from "@tanstack/react-query";

import { smartApi } from "@/lib/smart-ai-api";
import { ExternalLink } from "lucide-react";
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
    <div>
      <div>
        <div>
          <h1>
            Job board <em>· aggregated leads</em>
          </h1>
          <div>
            Roles surfaced from configured sources. Save anything promising to the pipeline.
          </div>
        </div>
      </div>

      <div>
        <div>
          <div>
            <h2>Listings</h2>
            <span>{listings.length}</span>
          </div>
          <div>
            {listingsLoading && (
              <div>Loading…</div>
            )}
            {!listingsLoading && listings.length === 0 && (
              <div>
                No listings yet. Configure a source to start ingesting.
              </div>
            )}
            {listings.map((l, i) => (
              <div
                key={l.id}
                onClick={() => {
                  if (l.sourceUrl) window.open(l.sourceUrl, "_blank");
                }}
              >
                <CompanyMark name={l.company} />
                <div>
                  <div>{l.title}</div>
                  <div>
                    {[l.company, l.location, l.remoteType].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span>{salaryRange(l.salaryMin, l.salaryMax)}</span>
                <span>{l.sourcePlatform ?? "—"}</span>
                <ExternalLink size={13} />
              </div>
            ))}
          </div>
        </div>

        <aside>
          <div>
            <div>
              <h2>Sources</h2>
            </div>
            <div>
              {sources.length === 0 && (
                <div>No sources configured yet.</div>
              )}
              {sources.map((s) => (
                <div key={s.id}>
                  <span>
                    {s.enabled ? "[active]" : "[inactive]"}
                  </span>
                  <div>
                    <div>{s.name}</div>
                    {s.lastSyncedAt && (
                      <div>
                        synced {new Date(s.lastSyncedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {s.itemCount != null && (
                    <span>{s.itemCount}</span>
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
