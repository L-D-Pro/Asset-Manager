# Gamification Engine & Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Remove Mantine, build a Duolingo-style gamification system with XP/streaks/achievements/quests, and redesign the dashboard with vibrant gamified components styled via CSS variables.

**Architecture:** Phase 0 removes all Mantine imports from the dashboard and replaces them with Radix primitives + native HTML styled via Tailwind/CSS variables. Phase 1 builds the gamification backend (DB schema, service, API routes). Phase 2 creates the gamified component library. Phase 3 redesigns the dashboard hub. Phase 4 wires XP awards into existing feature routes.

**Tech Stack:** React 19.1.0, Vite, TypeScript 5.9, Express 5, Drizzle ORM (PostgreSQL), Radix UI primitives, framer-motion, class-variance-authority, Tailwind CSS, CSS variables (Higo theme bridge)

---

## Phase 0: Remove Mantine

### Task 0.1: Remove Mantine packages from dashboard

**Files:**
- Modify: \`artifacts/dashboard/package.json\`

- [ ] **Step 1: Remove all @mantine/* entries from dependencies**

Open \`artifacts/dashboard/package.json\` and remove these 12 lines from \`dependencies\`:

\`\`\`
"@mantine/core": "^9.1.1",
"@mantine/hooks": "^9.1.1",
"@mantine/dates": "^9.1.1",
"@mantine/charts": "^9.1.1",
"@mantine/carousel": "^9.1.1",
"@mantine/code-highlight": "^9.1.1",
"@mantine/dropzone": "^9.1.1",
"@mantine/modals": "^9.1.1",
"@mantine/notifications": "^9.1.1",
"@mantine/nprogress": "^9.1.1",
"@mantine/spotlight": "^9.1.1",
"@mantine/tiptap": "^9.1.1",
\`\`\`

- [ ] **Step 2: Run install to clean up**

Run: \`corepack pnpm install\`

- [ ] **Step 3: Commit**

\`\`\`bash
git add artifacts/dashboard/package.json pnpm-lock.yaml
git commit -m "chore: remove Mantine packages from dashboard dependencies"
\`\`\`

### Task 0.2: Replace Mantine Button with native button

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/button.tsx\`

- [ ] **Step 1: Rewrite button.tsx to use native <button> instead of Mantine**

Replace the entire file content with:

\`\`\`tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110",
        destructive:
          "bg-[linear-gradient(135deg,hsl(var(--destructive)),hsl(var(--destructive)/0.8))] text-destructive-foreground shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/30 hover:brightness-110",
        outline:
          "border-2 border-primary/30 bg-background/50 backdrop-blur-sm text-foreground hover:bg-primary/5 hover:border-primary/50 shadow-sm",
        secondary:
          "bg-[linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--secondary)/0.8))] text-secondary-foreground shadow-md hover:brightness-105",
        ghost: "border-2 border-transparent text-foreground hover:bg-muted/50 hover:border-border/50",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto font-normal rounded-none shadow-none active:scale-100",
      },
      size: {
        default: "min-h-10 px-5 py-2.5",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-12 rounded-2xl px-8 text-base",
        icon: "h-10 w-10 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/button.tsx
git commit -m "refactor: replace Mantine Button with native button + gradient styles"
\`\`\`

### Task 0.3: Replace Mantine Badge with native span

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/badge.tsx\`

- [ ] **Step 1: Rewrite badge.tsx to use native <span>**

Replace the entire file content with:

\`\`\`tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary",
        secondary:
          "border-transparent bg-secondary/50 text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        outline:
          "text-foreground border-border/70",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/badge.tsx
git commit -m "refactor: replace Mantine Badge with native span"
\`\`\`

### Task 0.4: Replace Mantine Progress with Radix Progress + custom styling

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/progress.tsx\`

- [ ] **Step 1: Rewrite progress.tsx using Radix Progress**

\`\`\`tsx
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indeterminate,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indeterminate?: boolean
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 rounded-full",
          indeterminate
            ? "animate-indeterminate-progress bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.5)_50%,hsl(var(--primary))_100%)]"
            : "bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)] transition-all duration-500"
        )}
        style={{
          transform: indeterminate
            ? undefined
            : \`translateX(-\${100 - (value || 0)}%)\`,
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/progress.tsx
git commit -m "refactor: replace Mantine Progress with Radix Progress + gradient"
\`\`\`

### Task 0.5: Replace Mantine Skeleton with custom Tailwind skeleton

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/skeleton.tsx\`

- [ ] **Step 1: Rewrite skeleton.tsx**

\`\`\`tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted/60",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/skeleton.tsx
git commit -m "refactor: replace Mantine Skeleton with Tailwind pulse"
\`\`\`

### Task 0.6: Replace Mantine Switch with Radix Switch

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/switch.tsx\`

- [ ] **Step 1: Rewrite switch.tsx**

\`\`\`tsx
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitives.Root>
  )
}

export { Switch }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/switch.tsx
git commit -m "refactor: replace Mantine Switch with Radix Switch"
\`\`\`

### Task 0.7: Replace Mantine Separator/Divider with native element

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/separator.tsx\`

- [ ] **Step 1: Rewrite separator.tsx**

\`\`\`tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/separator.tsx
git commit -m "refactor: replace Mantine Divider with native separator"
\`\`\`

### Task 0.8: Replace Mantine ScrollArea with native overflow

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/scroll-area.tsx\`

- [ ] **Step 1: Rewrite scroll-area.tsx**

\`\`\`tsx
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
  return null // Scrollbar is native via overflow-auto
}

export { ScrollArea, ScrollBar }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/scroll-area.tsx
git commit -m "refactor: replace Mantine ScrollArea with native overflow-auto"
\`\`\`

### Task 0.9: Replace Mantine Table with native table + Tailwind

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/table.tsx\`

- [ ] **Step 1: Rewrite table.tsx**

\`\`\`tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-border/50", className)} {...props} />
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}

function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn("border-t border-border/50 bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border/30 transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted", className)} {...props} />
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-12 px-4 text-left align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0", className)} {...props} />
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
}

function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/table.tsx
git commit -m "refactor: replace Mantine Table with native table + Tailwind"
\`\`\`

### Task 0.10: Replace Mantine Tabs with Radix Tabs

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/tabs.tsx\`

- [ ] **Step 1: Rewrite tabs.tsx**

\`\`\`tsx
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/tabs.tsx
git commit -m "refactor: replace Mantine Tabs with Radix Tabs"
\`\`\`

### Task 0.11: Replace Mantine RadioGroup with Radix RadioGroup

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/radio-group.tsx\`

- [ ] **Step 1: Rewrite radio-group.tsx**

\`\`\`tsx
import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "@/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "aspect-square h-4 w-4 rounded-full border-2 border-primary/50 text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/radio-group.tsx
git commit -m "refactor: replace Mantine Radio with Radix RadioGroup"
\`\`\`

### Task 0.12: Replace Mantine Slider with Radix Slider

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/slider.tsx\`

- [ ] **Step 1: Rewrite slider.tsx**

\`\`\`tsx
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  )
}

export { Slider }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/slider.tsx
git commit -m "refactor: replace Mantine Slider with Radix Slider"
\`\`\`

### Task 0.13: Replace Mantine Checkbox with Radix Checkbox

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/checkbox.tsx\`

- [ ] **Step 1: Rewrite checkbox.tsx**

\`\`\`tsx
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-[4px] border-2 border-primary/50 shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <CheckIcon className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/checkbox.tsx
git commit -m "refactor: replace Mantine Checkbox with Radix Checkbox"
\`\`\`

### Task 0.14: Replace Mantine Label with native <label>

**Files:**
- Modify: \`artifacts/dashboard/src/components/ui/label.tsx\`

- [ ] **Step 1: Rewrite label.tsx**

\`\`\`tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

export { Label }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/ui/label.tsx
git commit -m "refactor: replace Mantine Input.Label with native label"
\`\`\`

### Task 0.15: Remove MantineProvider from App.tsx

**Files:**
- Modify: \`artifacts/dashboard/src/App.tsx\`

- [ ] **Step 1: Remove MantineProvider import and wrapper**

Remove line 4:
\`\`\`
import { MantineProvider, createTheme } from "@mantine/core";
\`\`\`

Change the \`App\` function at line 200 from:
\`\`\`tsx
function App() {
  const base = import.meta.env.BASE_URL.replace(/\\/$/, "");
  return (
    <MantineProvider theme={createTheme({ primaryColor: "blue", fontFamily: "var(--app-font-sans)" })}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter basename={base}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
    </MantineProvider>
  );
}
\`\`\`

To:
\`\`\`tsx
function App() {
  const base = import.meta.env.BASE_URL.replace(/\\/$/, "");
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter basename={base}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/App.tsx
git commit -m "refactor: remove MantineProvider from App root"
\`\`\`

### Task 0.16: Run typecheck after Mantine removal

- [ ] **Step 1: Run dashboard typecheck**

Run: \`corepack pnpm --filter @workspace/dashboard run typecheck\`

Expected: PASS (may have some issues from places we missed)

- [ ] **Step 2: Fix any remaining Mantine imports**

Search for remaining Mantine imports:
Run: \`rg "from \\"@mantine/core\\"" artifacts/dashboard/src\`

If any files still import Mantine, rewrite them similarly to the patterns above.

- [ ] **Step 3: Commit any fixes**

\`\`\`bash
git add -A
git commit -m "fix: remove remaining Mantine imports"
\`\`\`

---

## Phase 1: Gamification Engine (Backend)

### Task 1.1: Create DB schema for gamification tables

**Files:**
- Create: \`lib/db/src/schema/gamification.ts\`

- [ ] **Step 1: Write schema file**

\`\`\`ts
import { pgTable, text, serial, timestamp, jsonb, integer, date, boolean, index, unique } from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin-users";

export const userStatsTable = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  totalXp: integer("total_xp").notNull().default(0),
  currentLevel: integer("current_level").notNull().default(1),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: date("last_activity_date"),
  questsCompleted: integer("quests_completed").notNull().default(0),
  achievementsUnlocked: integer("achievements_unlocked").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const xpLogTable = pgTable("xp_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  xpAmount: integer("xp_amount").notNull(),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("xp_log_user_idx").on(table.userId),
  index("xp_log_action_idx").on(table.actionType),
]);

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconName: text("icon_name").notNull().default("trophy"),
  xpReward: integer("xp_reward").notNull().default(0),
  criteriaType: text("criteria_type").notNull(),
  criteriaValue: integer("criteria_value").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAchievementsTable = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  achievementId: integer("achievement_id").notNull().references(() => achievementsTable.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  seen: boolean("seen").notNull().default(false),
}, (table) => [
  unique("user_achievement_uidx").on(table.userId, table.achievementId),
]);

export const questsTable = pgTable("quests", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull().default(25),
  frequency: text("frequency").notNull().default("one_time"),
  criteriaType: text("criteria_type").notNull(),
  criteriaValue: integer("criteria_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userQuestsTable = pgTable("user_quests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  questId: integer("quest_id").notNull().references(() => questsTable.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const streakLogTable = pgTable("streak_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  xpEarnedToday: integer("xp_earned_today").notNull().default(0),
  actionsCount: integer("actions_count").notNull().default(0),
}, (table) => [
  unique("streak_log_user_date_uidx").on(table.userId, table.date),
]);

export type UserStats = typeof userStatsTable.$inferSelect;
export type XpLog = typeof xpLogTable.$inferSelect;
export type Achievement = typeof achievementsTable.$inferSelect;
export type UserAchievement = typeof userAchievementsTable.$inferSelect;
export type Quest = typeof questsTable.$inferSelect;
export type UserQuest = typeof userQuestsTable.$inferSelect;
export type StreakLog = typeof streakLogTable.$inferSelect;
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add lib/db/src/schema/gamification.ts
git commit -m "feat: add gamification DB schema (7 tables)"
\`\`\`

### Task 1.2: Add barrel export and relations

**Files:**
- Modify: \`lib/db/src/schema/index.ts\`
- Modify: \`lib/db/src/schema/relations.ts\`

- [ ] **Step 1: Add export to barrel**

Append to \`lib/db/src/schema/index.ts\`:
\`\`\`ts
export * from "./gamification";
\`\`\`

- [ ] **Step 2: Add relations**

Append to \`lib/db/src/schema/relations.ts\`:
\`\`\`ts
export const userStatsRelations = relations(userStatsTable, ({ one }) => ({
  user: one(adminUsersTable, { fields: [userStatsTable.userId], references: [adminUsersTable.id] }),
}));

export const xpLogRelations = relations(xpLogTable, ({ one }) => ({
  user: one(adminUsersTable, { fields: [xpLogTable.userId], references: [adminUsersTable.id] }),
}));
\`\`\`

- [ ] **Step 3: Commit**

\`\`\`bash
git add lib/db/src/schema/index.ts lib/db/src/schema/relations.ts
git commit -m "feat: add gamification barrel export and relations"
\`\`\`

### Task 1.3: Add runtime-compat.sql migrations

**Files:**
- Modify: \`lib/db/runtime-compat.sql\`

- [ ] **Step 1: Append DDL**

Append to \`lib/db/runtime-compat.sql\`:

\`\`\`sql
-- Gamification: user_stats
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE,
    total_xp INTEGER NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    quests_completed INTEGER NOT NULL DEFAULT 0,
    achievements_unlocked INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gamification: xp_log
CREATE TABLE IF NOT EXISTS xp_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    xp_amount INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_log_user_idx ON xp_log(user_id);
CREATE INDEX IF NOT EXISTS xp_log_action_idx ON xp_log(action_type);

-- Gamification: achievements
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL DEFAULT 'trophy',
    xp_reward INTEGER NOT NULL DEFAULT 0,
    criteria_type TEXT NOT NULL,
    criteria_value INTEGER NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gamification: user_achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seen BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS user_achievement_uidx ON user_achievements(user_id, achievement_id);

-- Gamification: quests
CREATE TABLE IF NOT EXISTS quests (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 25,
    frequency TEXT NOT NULL DEFAULT 'one_time',
    criteria_type TEXT NOT NULL,
    criteria_value INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gamification: user_quests
CREATE TABLE IF NOT EXISTS user_quests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Gamification: streak_log
CREATE TABLE IF NOT EXISTS streak_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    xp_earned_today INTEGER NOT NULL DEFAULT 0,
    actions_count INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS streak_log_user_date_uidx ON streak_log(user_id, date);
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add lib/db/runtime-compat.sql
git commit -m "feat: add gamification tables to runtime-compat.sql"
\`\`\`

### Task 1.4: Create gamification service

**Files:**
- Create: \`artifacts/api-server/src/lib/gamification.ts\`

- [ ] **Step 1: Write gamification service**

\`\`\`ts
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { db, userStatsTable, xpLogTable, achievementsTable, userAchievementsTable, questsTable, userQuestsTable, streakLogTable } from "@workspace/db";

const XP_AWARDS: Record<string, number> = {
  job_apply: 50,
  wizard_complete: 100,
  resume_tailor: 75,
  cover_letter: 75,
  compare: 25,
  ai_visit: 10,
  daily_login: 15,
};

export function getXpForAction(actionType: string): number {
  return XP_AWARDS[actionType] ?? 5;
}

export function computeLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

export function xpToNextLevel(totalXp: number): number {
  const currentLevel = computeLevel(totalXp);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  return nextLevelXp - totalXp;
}

export async function getOrCreateUserStats(userId: number) {
  let stats = await db.query.userStatsTable.findFirst({
    where: eq(userStatsTable.userId, userId),
  });
  if (!stats) {
    const [row] = await db.insert(userStatsTable).values({ userId }).returning();
    stats = row;
  }
  return stats;
}

export async function recordStreakActivity(userId: number, xpEarned: number) {
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await db
    .select()
    .from(streakLogTable)
    .where(and(eq(streakLogTable.userId, userId), eq(streakLogTable.date, today)));

  if (existing) {
    await db
      .update(streakLogTable)
      .set({
        xpEarnedToday: existing.xpEarnedToday + xpEarned,
        actionsCount: existing.actionsCount + 1,
      })
      .where(eq(streakLogTable.id, existing.id));
  } else {
    await db.insert(streakLogTable).values({
      userId,
      date: today,
      xpEarnedToday: xpEarned,
      actionsCount: 1,
    });
  }

  // Recalculate streak
  const logs = await db
    .select()
    .from(streakLogTable)
    .where(eq(streakLogTable.userId, userId))
    .orderBy(desc(streakLogTable.date))
    .limit(31);

  let streak = 0;
  const expected = new Date(today);
  for (const log of logs) {
    const logDate = new Date(log.date).toISOString().slice(0, 10);
    const exp = expected.toISOString().slice(0, 10);
    if (logDate === exp) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }

  const stats = await getOrCreateUserStats(userId);
  await db
    .update(userStatsTable)
    .set({
      currentStreak: streak,
      longestStreak: Math.max(streak, stats.longestStreak),
      lastActivityDate: today,
    })
    .where(eq(userStatsTable.userId, userId));

  return streak;
}

export async function awardXp(userId: number, actionType: string, metadata: Record<string, unknown> = {}) {
  const xpAmount = getXpForAction(actionType);

  const [log] = await db
    .insert(xpLogTable)
    .values({ userId, actionType, xpAmount, metadata })
    .returning();

  const stats = await getOrCreateUserStats(userId);
  const newTotal = stats.totalXp + xpAmount;
  const oldLevel = computeLevel(stats.totalXp);
  const newLevel = computeLevel(newTotal);

  await db
    .update(userStatsTable)
    .set({ totalXp: newTotal, currentLevel: newLevel })
    .where(eq(userStatsTable.userId, userId));

  // Check achievements
  const unlocked = await checkAchievements(userId);

  // Update quests
  await updateQuestProgress(userId, actionType);

  await recordStreakActivity(userId, xpAmount);

  return {
    xpAwarded: xpAmount,
    totalXp: newTotal,
    currentLevel: newLevel,
    leveledUp: newLevel > oldLevel,
    newLevel: newLevel > oldLevel ? newLevel : undefined,
    xpToNext: xpToNextLevel(newTotal),
    unlockedAchievements: unlocked,
  };
}

async function checkAchievements(userId: number) {
  const stats = await getOrCreateUserStats(userId);

  // Count actions
  const [{ count: applyCount }] = await db
    .select({ count: sql<number>\`count(*)\` })
    .from(xpLogTable)
    .where(and(eq(xpLogTable.userId, userId), eq(xpLogTable.actionType, "job_apply")));
  const [{ count: wizardCount }] = await db
    .select({ count: sql<number>\`count(*)\` })
    .from(xpLogTable)
    .where(and(eq(xpLogTable.userId, userId), eq(xpLogTable.actionType, "wizard_complete")));
  const [{ count: questCount }] = await db
    .select({ count: sql<number>\`count(*)\` })
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "completed")));

  const checks: Record<string, boolean> = {
    first_apply: Number(applyCount) >= 1,
    power_user: Number(applyCount) >= 10,
    hundred_club: stats.totalXp >= 1000,
    week_streak: stats.currentStreak >= 7,
    month_streak: stats.currentStreak >= 30,
    double_digit: Number(questCount) >= 10,
    wizard_master: Number(wizardCount) >= 5,
  };

  const unlocked: { id: number; slug: string; name: string }[] = [];

  const achievements = await db.select().from(achievementsTable);
  for (const a of achievements) {
    if (checks[a.slug]) {
      const existing = await db.query.userAchievementsTable.findFirst({
        where: and(
          eq(userAchievementsTable.userId, userId),
          eq(userAchievementsTable.achievementId, a.id)
        ),
      });
      if (!existing) {
        await db.insert(userAchievementsTable).values({ userId, achievementId: a.id });
        await db
          .update(userStatsTable)
          .set({ achievementsUnlocked: sql\`\${userStatsTable.achievementsUnlocked} + 1\` })
          .where(eq(userStatsTable.userId, userId));
        // Award bonus XP
        await db
          .update(userStatsTable)
          .set({ totalXp: sql\`\${userStatsTable.totalXp} + \${a.xpReward}\` })
          .where(eq(userStatsTable.userId, userId));
        unlocked.push({ id: a.id, slug: a.slug, name: a.name });
      }
    }
  }

  return unlocked;
}

async function updateQuestProgress(userId: number, actionType: string) {
  const activeQuests = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "active")));

  for (const uq of activeQuests) {
    const [quest] = await db
      .select()
      .from(questsTable)
      .where(eq(questsTable.id, uq.questId));
    if (!quest) continue;

    if (quest.criteriaType === "action_count") {
      const conditions = [];
      if (quest.slug.includes("apply")) {
        conditions.push(eq(xpLogTable.actionType, "job_apply"));
      } else if (quest.slug.includes("wizard")) {
        conditions.push(eq(xpLogTable.actionType, "wizard_complete"));
      } else if (quest.slug.includes("tailor") || quest.slug.includes("resume")) {
        conditions.push(eq(xpLogTable.actionType, "resume_tailor"));
      }

      const [{ count }] = await db
        .select({ count: sql<number>\`count(*)\` })
        .from(xpLogTable)
        .where(and(eq(xpLogTable.userId, userId), ...conditions));

      const newProgress = Math.min(Number(count), quest.criteriaValue);

      if (newProgress >= quest.criteriaValue) {
        await db
          .update(userQuestsTable)
          .set({ progress: newProgress, status: "completed", completedAt: new Date() })
          .where(eq(userQuestsTable.id, uq.id));
        // Award quest XP
        await awardXp(userId, \`quest_\${quest.slug}\`, { questId: quest.id });
        await db
          .update(userStatsTable)
          .set({ questsCompleted: sql\`\${userStatsTable.questsCompleted} + 1\` })
          .where(eq(userStatsTable.userId, userId));
      } else if (newProgress > uq.progress) {
        await db
          .update(userQuestsTable)
          .set({ progress: newProgress })
          .where(eq(userQuestsTable.id, uq.id));
      }
    }
  }
}

export async function getGamificationStats(userId: number) {
  const stats = await getOrCreateUserStats(userId);

  const activeQuests = await db
    .select({ userQuest: userQuestsTable, quest: questsTable })
    .from(userQuestsTable)
    .innerJoin(questsTable, eq(userQuestsTable.questId, questsTable.id))
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "active")));

  const unlocked = await db
    .select({ ua: userAchievementsTable, a: achievementsTable })
    .from(userAchievementsTable)
    .innerJoin(achievementsTable, eq(userAchievementsTable.achievementId, achievementsTable.id))
    .where(eq(userAchievementsTable.userId, userId))
    .orderBy(desc(userAchievementsTable.unlockedAt));

  return {
    totalXp: stats.totalXp,
    currentLevel: stats.currentLevel,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    xpToNextLevel: xpToNextLevel(stats.totalXp),
    questsCompleted: stats.questsCompleted,
    achievementsUnlocked: stats.achievementsUnlocked,
    activeQuests: activeQuests.map((aq) => ({
      id: aq.userQuest.id,
      questId: aq.quest.id,
      name: aq.quest.name,
      description: aq.quest.description,
      xpReward: aq.quest.xpReward,
      frequency: aq.quest.frequency,
      progress: aq.userQuest.progress,
      criteriaValue: aq.quest.criteriaValue,
      status: aq.userQuest.status,
      startedAt: aq.userQuest.startedAt,
    })),
    recentAchievements: unlocked.slice(0, 5).map((u) => ({
      id: u.ua.id,
      slug: u.a.slug,
      name: u.a.name,
      description: u.a.description,
      iconName: u.a.iconName,
      unlockedAt: u.ua.unlockedAt,
      seen: u.ua.seen,
    })),
  };
}
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/api-server/src/lib/gamification.ts
git commit -m "feat: add gamification service (XP, streaks, achievements, quests)"
\`\`\`

### Task 1.5: Create gamification API routes

**Files:**
- Create: \`artifacts/api-server/src/routes/gamification.ts\`

- [ ] **Step 1: Write routes**

\`\`\`ts
import { Router, type IRouter } from "express";
import { db, achievementsTable, userAchievementsTable, questsTable, userQuestsTable, xpLogTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import type { JobOpsRequest } from "../lib/http-types";
import { getGamificationStats, getOrCreateUserStats } from "../lib/gamification";

const router: IRouter = Router();

// GET /gamification/stats
router.get("/gamification/stats", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const stats = await getGamificationStats(userId);
  res.json(stats);
});

// GET /gamification/xp/history
router.get("/gamification/xp/history", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const items = await db
    .select()
    .from(xpLogTable)
    .where(eq(xpLogTable.userId, userId))
    .orderBy(desc(xpLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: db.fn.count() })
    .from(xpLogTable)
    .where(eq(xpLogTable.userId, userId));

  res.json({ items, total: Number(count) });
});

// GET /gamification/achievements
router.get("/gamification/achievements", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;

  const all = await db.select().from(achievementsTable).orderBy(achievementsTable.id);
  const unlocked = await db
    .select()
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, userId));

  res.json({ achievements: all, unlocked });
});

// POST /gamification/achievements/:id/seen
router.post("/gamification/achievements/:id/seen", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const id = Number(req.params.id);

  await db
    .update(userAchievementsTable)
    .set({ seen: true })
    .where(and(eq(userAchievementsTable.userId, userId), eq(userAchievementsTable.achievementId, id)));

  res.json({ success: true });
});

// GET /gamification/quests
router.get("/gamification/quests", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;

  const active = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "active")));

  const completed = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.status, "completed")))
    .orderBy(desc(userQuestsTable.completedAt))
    .limit(10);

  const available = await db.select().from(questsTable);

  res.json({ active, completed, available });
});

// POST /gamification/quests/:questId/accept
router.post("/gamification/quests/:questId/accept", async (req: JobOpsRequest, res) => {
  const userId = req.session.adminId!;
  const questId = Number(req.params.questId);

  const existing = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.questId, questId), eq(userQuestsTable.status, "active")))
    .limit(1);

  if (existing.length > 0) {
    res.json({ quest: existing[0] });
    return;
  }

  const [row] = await db
    .insert(userQuestsTable)
    .values({ userId, questId })
    .returning();

  res.status(201).json({ quest: row });
});

export default router;
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/api-server/src/routes/gamification.ts
git commit -m "feat: add gamification API routes"
\`\`\`

### Task 1.6: Register gamification router and run DB compat

**Files:**
- Modify: \`artifacts/api-server/src/routes/index.ts\`

- [ ] **Step 1: Register the router**

Add import near line 26 (after the last router import):
\`\`\`ts
import gamificationRouter from "./gamification";
\`\`\`

Add router registration after the last protected route (after line 79):
\`\`\`ts
router.use(gamificationRouter);
\`\`\`

- [ ] **Step 2: Push DB schema**

Run:
\`\`\`powershell
$env:DATABASE_URL = (Select-String -Path .env -Pattern "^DATABASE_URL=(.*)" | ForEach-Object { $_.Matches.Groups[1].Value })
corepack pnpm --filter @workspace/db run compat
\`\`\`

- [ ] **Step 3: Commit**

\`\`\`bash
git add artifacts/api-server/src/routes/index.ts
git commit -m "feat: register gamification router"
\`\`\`

### Task 1.7: Run full typecheck after backend changes

- [ ] **Step 1: Run typecheck**

\`\`\`powershell
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/db run typecheck
\`\`\`

Expected: PASS

- [ ] **Step 2: Fix any type errors and commit**

\`\`\`bash
git add -A
git commit -m "fix: typecheck fixes for gamification backend"
\`\`\`

---

## Phase 2: Gamified Visual System (Frontend)

### Task 2.1: Create GradientButton component

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/GradientButton.tsx\`

- [ ] **Step 1: Write component**

\`\`\`tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const gradientButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 active:scale-[0.96] hover:scale-[1.02]",
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.7))] text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:brightness-110",
        secondary:
          "bg-[linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--secondary)/0.7))] text-secondary-foreground shadow-lg hover:brightness-105",
        ghost:
          "bg-transparent border-2 border-border/50 text-foreground hover:border-primary/30 hover:bg-muted/30 shadow-none hover:scale-[1.02] active:scale-[0.96]",
        quest:
          "bg-[linear-gradient(135deg,#f59e0b,#d97706)] text-white shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40",
      },
      size: {
        sm: "min-h-8 rounded-xl px-4 text-sm",
        md: "min-h-11 px-6 text-base",
        lg: "min-h-14 rounded-3xl px-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
  asChild?: boolean
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(gradientButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
GradientButton.displayName = "GradientButton"

export { GradientButton, gradientButtonVariants }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/gamification/GradientButton.tsx
git commit -m "feat: add GradientButton gamified component"
\`\`\`

### Task 2.2: Create ProgressRing component

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/ProgressRing.tsx\`

- [ ] **Step 1: Write component**

\`\`\`tsx
import { cn } from "@/lib/utils"

interface ProgressRingProps {
  progress: number // 0-1
  size?: number
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
}

function ProgressRing({ progress, size = 80, strokeWidth = 6, className, children }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - progress * circumference

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary)/0.4))" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

export { ProgressRing }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/gamification/ProgressRing.tsx
git commit -m "feat: add ProgressRing SVG component"
\`\`\`

### Task 2.3: Create XPCard component

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/XPCard.tsx\`

- [ ] **Step 1: Write component**

\`\`\`tsx
import { ProgressRing } from "./ProgressRing"
import { cn } from "@/lib/utils"

interface XPCardProps {
  totalXp: number
  currentLevel: number
  xpToNextLevel: number
  className?: string
}

function XPCard({ totalXp, currentLevel, xpToNextLevel, className }: XPCardProps) {
  const levelFloor = (currentLevel - 1) * (currentLevel - 1) * 100
  const progress = xpToNextLevel > 0 ? (totalXp - levelFloor) / (xpToNextLevel + totalXp - levelFloor) : 1

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-border/50 bg-[linear-gradient(145deg,hsl(var(--card)),hsl(var(--card))_50%,hsl(var(--primary)/0.04))] p-5 backdrop-blur-sm",
      className
    )}>
      <div className="flex items-center gap-4">
        <ProgressRing progress={progress} size={72} strokeWidth={5}>
          <span className="text-xl font-bold text-foreground">{currentLevel}</span>
        </ProgressRing>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Level {currentLevel}</p>
          <p className="text-lg font-bold text-foreground">{totalXp.toLocaleString()} XP</p>
          <p className="text-xs text-muted-foreground mt-1">
            {xpToNextLevel.toLocaleString()} XP to Level {currentLevel + 1}
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)/0.7))] shadow-[0_0_10px_-2px_hsl(var(--primary)/0.5)] transition-all duration-700"
              style={{ width: \`\${progress * 100}%\` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export { XPCard }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/gamification/XPCard.tsx
git commit -m "feat: add XPCard gamified component"
\`\`\`

### Task 2.4: Create GamifiedBadge component

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/GamifiedBadge.tsx\`

- [ ] **Step 1: Write component**

\`\`\`tsx
import { cn } from "@/lib/utils"

interface GamifiedBadgeProps {
  icon: string
  name: string
  description?: string
  variant?: "gold" | "silver" | "bronze"
  isNew?: boolean
  className?: string
}

const variantStyles = {
  gold: "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200",
  silver: "border-slate-300 bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300",
  bronze: "border-orange-300 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200",
}

function GamifiedBadge({ icon, name, description, variant = "bronze", isNew, className }: GamifiedBadgeProps) {
  return (
    <div className={cn(
      "relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 text-center transition-all hover:scale-105",
      variantStyles[variant],
      className
    )}>
      {isNew && (
        <span className="absolute -top-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground animate-pulse">
          NEW
        </span>
      )}
      <span className="text-3xl">{icon}</span>
      <span className="text-xs font-bold leading-tight">{name}</span>
      {description && (
        <span className="text-[10px] leading-tight opacity-70">{description}</span>
      )}
    </div>
  )
}

export { GamifiedBadge }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/gamification/GamifiedBadge.tsx
git commit -m "feat: add GamifiedBadge component"
\`\`\`

### Task 2.5: Create StreakFlame component

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/StreakFlame.tsx\`

- [ ] **Step 1: Write component**

\`\`\`tsx
import { cn } from "@/lib/utils"

interface StreakFlameProps {
  streak: number
  longestStreak: number
  className?: string
}

function getFlameIntensity(streak: number): string {
  if (streak >= 30) return "scale-125 drop-shadow-[0_0_18px_#f59e0b]"
  if (streak >= 7) return "scale-110 drop-shadow-[0_0_12px_#f59e0b]"
  if (streak >= 3) return "scale-105 drop-shadow-[0_0_6px_#f59e0b]"
  return ""
}

function StreakFlame({ streak, longestStreak, className }: StreakFlameProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 backdrop-blur-sm",
      className
    )}>
      <span className={cn(
        "text-4xl transition-all duration-500",
        streak > 0 ? "animate-pulse" : "opacity-30 grayscale",
        getFlameIntensity(streak)
      )}>
        🔥
      </span>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn(
            "text-2xl font-black tabular-nums",
            streak > 0 ? "text-amber-500" : "text-muted-foreground"
          )}>
            {streak}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {streak === 1 ? "day" : "days"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Longest: {longestStreak} days
        </p>
      </div>
    </div>
  )
}

export { StreakFlame }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/gamification/StreakFlame.tsx
git commit -m "feat: add StreakFlame component"
\`\`\`

### Task 2.6: Create QuestCard component

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/QuestCard.tsx\`

- [ ] **Step 1: Write component**

\`\`\`tsx
import { GradientButton } from "./GradientButton"
import { cn } from "@/lib/utils"

interface QuestCardProps {
  questId: number
  name: string
  description: string
  xpReward: number
  progress: number
  criteriaValue: number
  status: "active" | "completed"
  frequency?: string
  onAccept?: (questId: number) => void
  className?: string
}

function QuestCard({ questId, name, description, xpReward, progress, criteriaValue, status, frequency, onAccept, className }: QuestCardProps) {
  const completed = status === "completed" || progress >= criteriaValue
  const pct = Math.min((progress / criteriaValue) * 100, 100)

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all",
      completed
        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
        : "border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30",
      className
    )}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className={cn(
            "font-bold text-sm",
            completed ? "text-emerald-800 dark:text-emerald-200" : "text-foreground"
          )}>
            {completed ? "✓ " : ""}{name}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-bold",
          completed
            ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
            : "bg-primary/10 text-primary"
        )}>
          +{xpReward} XP
        </span>
      </div>
      {!completed && (
        <>
          <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)/0.7))] transition-all duration-500"
              style={{ width: \`\${pct}%\` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">{progress}/{criteriaValue}</span>
            {frequency && (
              <span className="text-[11px] text-muted-foreground capitalize">{frequency}</span>
            )}
          </div>
        </>
      )}
      {onAccept && (
        <GradientButton
          size="sm"
          variant="ghost"
          className="w-full mt-3"
          onClick={() => onAccept(questId)}
        >
          Accept
        </GradientButton>
      )}
    </div>
  )
}

export { QuestCard }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/gamification/QuestCard.tsx
git commit -m "feat: add QuestCard component"
\`\`\`

### Task 2.7: Create AchievementToast component

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/AchievementToast.tsx\`

- [ ] **Step 1: Write component**

\`\`\`tsx
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface AchievementToastProps {
  icon: string
  name: string
  description: string
  onDismiss: () => void
}

function AchievementToast({ icon, name, description, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn(
      "pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-amber-400/50 bg-card p-4 shadow-2xl transition-all duration-300",
      visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
    )}>
      <span className="text-3xl animate-bounce">{icon}</span>
      <div>
        <p className="text-sm font-bold text-amber-500">Achievement Unlocked!</p>
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

interface AchievementToasterProps {
  toasts: Array<{ id: string; icon: string; name: string; description: string }>
  onDismiss: (id: string) => void
}

function AchievementToaster({ toasts, onDismiss }: AchievementToasterProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <AchievementToast
          key={t.id}
          icon={t.icon}
          name={t.name}
          description={t.description}
          onDismiss={() => onDismiss(t.id)}
        />
      ))}
    </div>
  )
}

export { AchievementToast, AchievementToaster }
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/components/gamification/AchievementToast.tsx
git commit -m "feat: add AchievementToast component"
\`\`\`

### Task 2.8: Create gamification barrel export

**Files:**
- Create: \`artifacts/dashboard/src/components/gamification/index.ts\`

- [ ] **Step 1: Write barrel**

\`\`\`ts
export { GradientButton, gradientButtonVariants } from "./GradientButton"
export { ProgressRing } from "./ProgressRing"
export { XPCard } from "./XPCard"
export { GamifiedBadge } from "./GamifiedBadge"
export { StreakFlame } from "./StreakFlame"
export { QuestCard } from "./QuestCard"
export { AchievementToast, AchievementToaster } from "./AchievementToast"
\`\`\`

- [ ] **Step 2: Run typecheck and commit**

\`\`\`bash
corepack pnpm --filter @workspace/dashboard run typecheck
git add artifacts/dashboard/src/components/gamification/index.ts
git commit -m "feat: add gamification component barrel export"
\`\`\`

---

## Phase 3: Dashboard Hub Redesign

### Task 3.1: Rewrite dashboard page with gamification

**Files:**
- Modify: \`artifacts/dashboard/src/pages/dashboard/index.tsx\`

- [ ] **Step 1: Read current dashboard to understand what to keep and replace**

Before modifying, read the existing dashboard page to understand its current structure.

- [ ] **Step 2: Write gamified dashboard**

The new dashboard will wrap the existing content in gamified UI elements. The implementation:

- At top of imports, add:
\`\`\`tsx
import { XPCard } from "@/components/gamification/XPCard"
import { StreakFlame } from "@/components/gamification/StreakFlame"
import { QuestCard } from "@/components/gamification/QuestCard"
import { GamifiedBadge } from "@/components/gamification/GamifiedBadge"
import { AchievementToaster } from "@/components/gamification/AchievementToast"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client" // or however the project exports an API client
\`\`\`

- Add a gamification context provider at the page level that:
  - Fetches \`GET /api/gamification/stats\` on mount
  - Tracks achievement toasts (unseen achievements become toasts)
  - Provides the gamification state to child components

- Insert the gamified dashboard sections (XPCard, StreakFlame, quests, achievements) as a "gamification strip" at the top of the main content area, above the existing dashboard content

- [ ] **Step 3: Commit**

\`\`\`bash
git add artifacts/dashboard/src/pages/dashboard/index.tsx
git commit -m "feat: add gamification strip to dashboard"
\`\`\`

### Task 3.2: Create gamification API hooks

**Files:**
- Create: \`artifacts/dashboard/src/hooks/use-gamification.ts\`

- [ ] **Step 1: Write hooks**

\`\`\`ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/hooks/use-toast"

interface GamificationStats {
  totalXp: number
  currentLevel: number
  currentStreak: number
  longestStreak: number
  xpToNextLevel: number
  questsCompleted: number
  achievementsUnlocked: number
  activeQuests: Array<{
    id: number
    questId: number
    name: string
    description: string
    xpReward: number
    frequency: string
    progress: number
    criteriaValue: number
    status: string
    startedAt: string
  }>
  recentAchievements: Array<{
    id: number
    slug: string
    name: string
    description: string
    iconName: string
    unlockedAt: string
    seen: boolean
  }>
}

interface XpHistoryItem {
  id: number
  actionType: string
  xpAmount: number
  metadata: Record<string, unknown>
  createdAt: string
}

interface Achievement {
  id: number
  slug: string
  name: string
  description: string
  iconName: string
  xpReward: number
  criteriaType: string
  criteriaValue: number
  isHidden: boolean
}

interface UserAchievement {
  id: number
  userId: number
  achievementId: number
  unlockedAt: string
  seen: boolean
}

interface Quest {
  id: number
  slug: string
  name: string
  description: string
  xpReward: number
  frequency: string
  criteriaType: string
  criteriaValue: number
}

interface UserQuest {
  id: number
  userId: number
  questId: number
  progress: number
  status: string
  startedAt: string
  completedAt: string | null
}

const API_BASE = "/api/gamification"

export function useGamificationStats() {
  return useQuery({
    queryKey: ["gamification", "stats"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/stats", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch gamification stats")
      return res.json() as Promise<GamificationStats>
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useXpHistory() {
  return useQuery({
    queryKey: ["gamification", "xp", "history"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/xp/history", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch XP history")
      return res.json() as Promise<{ items: XpHistoryItem[]; total: number }>
    },
  })
}

export function useAchievements() {
  return useQuery({
    queryKey: ["gamification", "achievements"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/achievements", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch achievements")
      return res.json() as Promise<{ achievements: Achievement[]; unlocked: UserAchievement[] }>
    },
  })
}

export function useMarkAchievementSeen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (achievementId: number) => {
      const res = await fetch(API_BASE + \`/achievements/\${achievementId}/seen\`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to mark achievement seen")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification"] })
    },
  })
}

export function useQuests() {
  return useQuery({
    queryKey: ["gamification", "quests"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/quests", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch quests")
      return res.json() as Promise<{ active: UserQuest[]; completed: UserQuest[]; available: Quest[] }>
    },
  })
}

export function useAcceptQuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (questId: number) => {
      const res = await fetch(API_BASE + \`/quests/\${questId}/accept\`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to accept quest")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification"] })
      toast({ title: "Quest accepted!", description: "Start working toward your goal." })
    },
  })
}
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/dashboard/src/hooks/use-gamification.ts
git commit -m "feat: add gamification API hooks"
\`\`\`

### Task 3.3: Run typecheck after dashboard changes

- [ ] **Step 1: Run typecheck**

\`\`\`powershell
corepack pnpm --filter @workspace/dashboard run typecheck
\`\`\`

- [ ] **Step 2: Fix any issues and commit**

\`\`\`bash
git add -A
git commit -m "fix: typecheck fixes for dashboard gamification"
\`\`\`

---

## Phase 4: Feature Integration

### Task 4.1: Award XP on job apply

**Files:**
- Modify: \`artifacts/api-server/src/routes/jobs.ts\`

- [ ] **Step 1: Add XP award to job apply handler**

In the handler for \`POST /jobs/:id/apply\`, after the application is successfully created, add:

\`\`\`ts
import { awardXp } from "../lib/gamification";

// Inside the apply handler, after successful insert:
const gamificationResult = await awardXp(req.session.adminId!, "job_apply", { jobId: job.id });
if (gamificationResult.leveledUp) {
  req.log.info({ newLevel: gamificationResult.newLevel }, "User leveled up");
}
// Optionally include gamification in the response:
// res.status(201).json({ application: row, gamification: gamificationResult });
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/api-server/src/routes/jobs.ts
git commit -m "feat: award XP on job apply"
\`\`\`

### Task 4.2: Award XP on wizard complete

- [ ] **Step 1: Add to wizard completion handler**

In the wizard routes (\`wizard-sessions.ts\`), find the completion handler and add:
\`\`\`ts
import { awardXp } from "../lib/gamification";
// On wizard complete:
await awardXp(req.session.adminId!, "wizard_complete", { wizardId: session.id });
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/api-server/src/routes/wizard-sessions.ts
git commit -m "feat: award XP on wizard completion"
\`\`\`

### Task 4.3: Award XP on model compare

- [ ] **Step 1: Add to compare handlers**

In \`jobs.ts\`, find the compare handlers (\`POST /jobs/:id/compare/resume\`, \`POST /jobs/:id/compare/cover-letter\`) and add:
\`\`\`ts
await awardXp(req.session.adminId!, "compare", { jobId: jobId });
\`\`\`

- [ ] **Step 2: Commit**

\`\`\`bash
git add artifacts/api-server/src/routes/jobs.ts
git commit -m "feat: award XP on model comparison"
\`\`\`

### Task 4.4: Award XP on daily login / AI visit

**Files:**
- Modify: \`artifacts/api-server/src/middlewares/auth.ts\` (or route handler)

- [ ] **Step 1: Add daily login XP**

In the auth middleware or a dedicated route handler, after successful authentication, check if this is the user's first request today:
\`\`\`ts
import { recordStreakActivity, getOrCreateUserStats, getXpForAction, awardXp } from "../lib/gamification";

// In a per-request middleware (or in requireAuth):
const stats = await getOrCreateUserStats(req.session.adminId!);
const today = new Date().toISOString().slice(0, 10);
if (stats.lastActivityDate !== today) {
  // Daily login bonus fires once
  await awardXp(req.session.adminId!, "daily_login", {});
}
\`\`\`

- [ ] **Step 2: Add AI visit XP**

In the AI learning route (\`ai-learning.ts\`), on page visit/view:
\`\`\`ts
// On AI learning page load (GET handler or dedicated endpoint):
await awardXp(req.session.adminId!, "ai_visit", {});
\`\`\`

- [ ] **Step 3: Commit**

\`\`\`bash
git add artifacts/api-server/src/middlewares/auth.ts artifacts/api-server/src/routes/ai-learning.ts
git commit -m "feat: award XP on daily login and AI visit"
\`\`\`

### Task 4.5: Final typecheck and integration test

- [ ] **Step 1: Run full typecheck**

\`\`\`powershell
corepack pnpm run typecheck
\`\`\`

Expected: PASS

- [ ] **Step 2: Verify gamification endpoints work**

Start dev server: \`corepack pnpm run dev\`

Test endpoints:
\`\`\`
GET /api/gamification/stats → should return stats with 0 XP for new user
GET /api/gamification/achievements → should return achievement definitions
GET /api/gamification/quests → should return available quests
POST /api/gamification/quests/1/accept → should create user_quest record
POST /api/jobs/:id/apply → should award XP (visible in stats after)
\`\`\`

- [ ] **Step 3: Commit any final fixes**

\`\`\`bash
git add -A
git commit -m "fix: final typecheck and integration fixes"
\`\`\`

- [ ] **Step 4: Update Migration_summary.md**

Replace the old "Mantine migration" content with a note about the new architecture:
\`\`\`md
## Migration Status: COMPLETE (2025-04-30)

The Mantine migration was replaced with a **hybrid Radix + gamified custom components** architecture.

### What was removed
- All @mantine/* packages from dashboard dependencies
- MantineProvider from App root
- All Mantine component wrappers (Button, Badge, Progress, Skeleton, Switch, Separator, ScrollArea, Table, Tabs, RadioGroup, Slider, Checkbox, Label)

### What was kept
- Radix primitives (stable with React 19.1.0)
- Higo UI Shell theme system (41 themes, CSS variable bridge)
- All layout components (main-layout, sidebar)

### What was added
- Gamification engine (7 DB tables, service, API routes)
- Gamified component library (GradientButton, ProgressRing, XPCard, GamifiedBadge, StreakFlame, QuestCard, AchievementToast)
- Feature integration (XP awards for job apply, wizard, compare, daily login, AI visit)

### Architecture
\`\`\`
React 19.1.0 + Vite
Radix UI primitives (dialogs, dropdowns, tooltips, selects, etc.)
Custom gamified components (buttons, cards, progress, badges)
CSS variables from Higo theme system (41 themes)
Gamification API + DB (XP, streaks, achievements, quests)
\`\`\`

- [ ] **Step 5: Commit migration summary update**

\`\`\`bash
git add Migration_summary.md
git commit -m "docs: update migration summary with final architectural state"
\`\`\`
