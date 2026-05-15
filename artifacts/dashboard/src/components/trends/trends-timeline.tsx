import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import type { MarketAnalysis } from "@workspace/api-client-react";

interface TrendsTimelineProps {
  trends: MarketAnalysis["trends"];
}

export function TrendsTimeline({ trends }: TrendsTimelineProps) {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>
            <ArrowUp />
            Emerging
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            {trends.emerging.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <ArrowDown />
            Declining
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            {trends.declining.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <RefreshCw />
            Industry Shifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            {trends.industryShifts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
