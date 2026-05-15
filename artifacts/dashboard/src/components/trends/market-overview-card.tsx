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
    above: <TrendingUp />,
    at: <Minus />,
    "below-market": <TrendingDown />,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Activity />
          Market Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Badge>
            Demand: {overview.demandLevel}
          </Badge>
          <Badge>
            Competition: {overview.competition}
          </Badge>
          <Badge variant="outline">
            {alignmentIcons[overview.salaryAlignment]}
            Salary: {overview.salaryAlignment.replace("-", " ")}
          </Badge>
        </div>
        <p>{overview.summary}</p>
      </CardContent>
    </Card>
  );
}
