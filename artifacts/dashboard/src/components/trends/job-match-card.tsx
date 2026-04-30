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
    <a
      href={job.sourceUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <Card className="transition-all hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold truncate group-hover:text-primary">
                  {job.title}
                </h4>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {job.location}
                  </span>
                )}
                {publishedAgo && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {publishedAgo}
                  </span>
                )}
              </div>
            </div>
            {job.jobType && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {job.jobType}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
