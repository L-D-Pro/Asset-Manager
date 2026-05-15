import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { smartApi } from "@/lib/smart-ai-api";

interface Claim {
  id: number;
  summary?: string;
  text?: string;
  category?: string;
  domain?: string | null;
  verified?: boolean;
  evidenceType?: string;
  tags?: string[];
}

interface CiteProps {
  id: number;
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
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <sup>[{id}]</sup>
      {open && claim && (
        <div>
          <div>
            Claim · {claim.category ?? claim.domain ?? "uncategorized"}
            {" "}#{id}
          </div>
          <div>
            {claim.summary ?? claim.text ?? ""}
          </div>
          <div>
            <span>
              {claim.verified ? "verified" : "unverified"}
            </span>
            {claim.evidenceType && (
              <span>· {claim.evidenceType}</span>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
