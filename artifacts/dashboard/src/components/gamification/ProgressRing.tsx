import { cn } from "@/lib/utils"

interface ProgressRingProps {
 progress: number
 size?: number
 strokeWidth?: number
 label?: string
 color?: "primary" | "accent"
 className?: string
}

function ProgressRing({
 progress,
 size = 80,
 strokeWidth = 8,
 label,
 color = "primary",
 className,
}: ProgressRingProps) {
 const radius = (size - strokeWidth) / 2
 const circumference = radius * 2 * Math.PI
 const clampedProgress = Math.min(Math.max(progress, 0), 100)
 const offset = circumference - (clampedProgress / 100) * circumference

 const strokeColor =
 color === "accent" ? "hsl(var(--accent))" : "hsl(var(--primary))"
 const strokeEnd =
 color === "accent" ? "hsl(var(--accent-dark))" : "hsl(var(--primary-dark))"

 const gradientId =
 color === "accent" ? "ring-gradient-accent" : "ring-gradient-primary"

 return (
 <div
 className={cn("relative inline-flex items-center justify-center", className)}
 >
 <svg
 width={size}
 height={size}
 className="-rotate-90"
 viewBox={`0 0 ${size} ${size}`}
 >
 <defs>
 <linearGradient
 id={gradientId}
 x1="0%"
 y1="0%"
 x2="100%"
 y2="100%"
 >
 <stop offset="0%" stopColor={strokeColor} />
 <stop offset="100%" stopColor={strokeEnd} />
 </linearGradient>
 </defs>
 <circle
 cx={size / 2}
 cy={size / 2}
 r={radius}
 fill="none"
 stroke="hsl(var(--border))"
 strokeWidth={strokeWidth}
 />
 <circle
 cx={size / 2}
 cy={size / 2}
 r={radius}
 fill="none"
 stroke={`url(#${gradientId})`}
 strokeWidth={strokeWidth}
 strokeDasharray={circumference}
 strokeDashoffset={offset}
 strokeLinecap="round"
 style={{ transition: "stroke-dashoffset 0.7s ease-out" }}
 />
 </svg>
 {label && (
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-2xl font-extrabold text-foreground font-display">
 {label}
 </span>
 </div>
 )}
 </div>
 )
}

export { ProgressRing }
