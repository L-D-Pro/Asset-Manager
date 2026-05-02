import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import type { MarketAnalysis } from "@workspace/api-client-react";

interface TrendsTimelineProps {
 trends: MarketAnalysis["trends"];
}

export function TrendsTimeline({ trends }: TrendsTimelineProps) {
 return (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-sm">
 <ArrowUp className="h-4 w-4 text-green-600" />
 Emerging
 </CardTitle>
 </CardHeader>
 <CardContent>
 <ul className="space-y-2">
 {trends.emerging.map((item) => (
 <li key={item} className="text-sm text-muted-foreground">
 {item}
 </li>
 ))}
 </ul>
 </CardContent>
 </Card>
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-sm">
 <ArrowDown className="h-4 w-4 text-red-600" />
 Declining
 </CardTitle>
 </CardHeader>
 <CardContent>
 <ul className="space-y-2">
 {trends.declining.map((item) => (
 <li key={item} className="text-sm text-muted-foreground">
 {item}
 </li>
 ))}
 </ul>
 </CardContent>
 </Card>
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-sm">
 <RefreshCw className="h-4 w-4 text-blue-600" />
 Industry Shifts
 </CardTitle>
 </CardHeader>
 <CardContent>
 <ul className="space-y-2">
 {trends.industryShifts.map((item) => (
 <li key={item} className="text-sm text-muted-foreground">
 {item}
 </li>
 ))}
 </ul>
 </CardContent>
 </Card>
 </div>
 );
}
