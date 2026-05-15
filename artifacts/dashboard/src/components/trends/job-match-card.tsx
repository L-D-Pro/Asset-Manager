import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Building2, MapPin, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobBoardListing } from "@workspace/api-client-react";

interface JobMatchCardProps {
  job: JobBoardListing;
}

export function JobMatchCard({ job }: JobMatchCardProps) {
  const publishedAgo = job.publishedAt
    ? formatDistanceToNow(new Date(job.publishedAt), { addSuffix: true })
    : null;

  return (
    <a href={job.sourceUrl ?? "#"} target="_blank" rel="noopener noreferrer">
      <Card>
        <CardContent>
          <div>
            <div>
              <div>
                <h4>{job.title}</h4>
                <ExternalLink />
              </div>
              <div>
                <span>
                  <Building2 />
                  {job.company}
                </span>
                {job.location && (
                  <span>
                    <MapPin />
                    {job.location}
                  </span>
                )}
                {publishedAgo && (
                  <span>
                    <Calendar />
                    {publishedAgo}
                  </span>
                )}
              </div>
            </div>
            {job.jobType && (
              <Badge variant="secondary">
                {job.jobType}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
