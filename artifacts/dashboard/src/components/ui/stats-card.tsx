import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { AnimatedCard } from "@/components/motion/animated-card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface StatsCardProps {
 title: string;
 value: number;
 isLoading: boolean;
 prefix?: string;
 suffix?: string;
 decimals?: number;
 trend: { value: number }[];
 trendUp: boolean;
 gradient: string;
 index?: number;
}

export function StatsCard({
 title,
 value,
 isLoading,
 prefix = "",
 suffix = "",
 decimals = 0,
 trend,
 trendUp,
 gradient,
 index = 0,
}: StatsCardProps) {
 return (
 <AnimatedCard index={index}>
 <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground transition-all duration-300 hover:border-primary/35">
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {isLoading ? (
 <Skeleton className="h-10 w-24" />
 ) : (
 <div className="flex items-baseline gap-2">
 <div className="text-2xl font-semibold tracking-normal text-foreground">
 <AnimatedCounter
 value={value}
 prefix={prefix}
 suffix={suffix}
 decimals={decimals}
 />
 </div>
 <div
 className={`flex items-center text-xs font-semibold ${
 trendUp ? "text-success" : "text-destructive"
 }`}
 >
 {trendUp ? (
 <TrendingUp className="h-3 w-3 mr-0.5" />
 ) : (
 <TrendingDown className="h-3 w-3 mr-0.5" />
 )}
 {(Math.random() * 8 + 1).toFixed(1)}%
 </div>
 </div>
 )}
 <div className="h-12 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={trend}>
 <defs>
 <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={gradient} stopOpacity={0.3} />
 <stop offset="95%" stopColor={gradient} stopOpacity={0} />
 </linearGradient>
 </defs>
 <Area
 type="monotone"
 dataKey="value"
 stroke={gradient}
 strokeWidth={2}
 fill={`url(#grad-${index})`}
 isAnimationActive={!isLoading}
 animationDuration={1200}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </div>
 </AnimatedCard>
 );
}
