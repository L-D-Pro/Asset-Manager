import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, FileText, Users, Calendar } from "lucide-react";

interface ActivityStats {
 jobsAppliedLastHour: number;
 jobsParsedToday: number;
 resumesGeneratedThisWeek: number;
 pilotUsersJoinedToday: number;
}

export function CommunityActivity() {
 const [stats, setStats] = useState<ActivityStats>({
 jobsAppliedLastHour: 0,
 jobsParsedToday: 0,
 resumesGeneratedThisWeek: 0,
 pilotUsersJoinedToday: 0,
 });

 useEffect(() => {
 async function fetchStats() {
 try {
 const res = await fetch("/api/activity-feed");
 if (res.ok) {
 const data = await res.json() as ActivityStats;
 setStats(data);
 }
 } catch {
 // silent
 }
 }
 fetchStats();
 const interval = setInterval(fetchStats, 60000);
 return () => clearInterval(interval);
 }, []);

 const items = [
 { label: "Jobs applied in the last hour", value: stats.jobsAppliedLastHour, icon: FileText },
 { label: "Job descriptions parsed today", value: stats.jobsParsedToday, icon: Activity },
 { label: "Resumes tailored this week", value: stats.resumesGeneratedThisWeek, icon: Calendar },
 { label: "New pilot users today", value: stats.pilotUsersJoinedToday, icon: Users },
 ];

 return (
 <Card className="border-dashed">
 <CardContent className="pt-4">
 <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
 Community Activity
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {items.map((item) => (
 <div key={item.label} className="text-center">
 <item.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
 <p className="text-xl font-bold tabular-nums">{item.value}</p>
 <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 );
}
