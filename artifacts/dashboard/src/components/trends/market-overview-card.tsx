import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import type { MarketAnalysis } from "@workspace/api-client-react";

interface MarketOverviewCardProps {
  overview: MarketAnalysis["marketOverview"];
}

export function MarketOverviewCard({ overview }: MarketOverviewCardProps) {
  const demandColors: Record<string, string> = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-red-100 text-red-800",
  };

  const competitionColors: Record<string, string> = {
    high: "bg-red-100 text-red-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-green-100 text-green-800",
  };

  const alignmentIcons: Record<string, React.ReactNode> = {
    above: <TrendingUp className="h-4 w-4 text-green-600" />,
    at: <Minus className="h-4 w-4 text-yellow-600" />,
    "below-market": <TrendingDown className="h-4 w-4 text-red-600" />,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Market Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={demandColors[overview.demandLevel]}>
            Demand: {overview.demandLevel}
          </Badge>
          <Badge className={competitionColors[overview.competition]}>
            Competition: {overview.competition}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            {alignmentIcons[overview.salaryAlignment]}
            Salary: {overview.salaryAlignment.replace("-", " ")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{overview.summary}</p>
      </CardContent>
    </Card>
  );
}
