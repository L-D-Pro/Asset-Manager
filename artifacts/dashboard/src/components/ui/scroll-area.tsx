import * as React from "react"

import { cn } from "@/lib/utils"

function ScrollArea({
 className,
 children,
 ...props
}: React.HTMLAttributes<HTMLDivElement>) {
 return (
 <div
 className={cn("overflow-auto", className)}
 {...props}
 >
 {children}
 </div>
 )
}

function ScrollBar({
 className,
 orientation = "vertical",
 ...props
}: React.HTMLAttributes<HTMLDivElement> & {
 orientation?: "vertical" | "horizontal"
}) {
 return null
}

export { ScrollArea, ScrollBar }
