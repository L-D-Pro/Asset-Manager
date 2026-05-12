import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/utils";
import {
 Home,
 Briefcase,
 Wand2,
 BarChart3,
 FileText,
 FileCheck,
 Mail,
 ShieldCheck,
 Layers,
 Target,
 Bot,
 Eye,
 LineChart,
 Settings2,
 Brain,
 MessageSquare,
 Handshake,
 TrendingUp,
 BookOpen,
 UserCircle,
 HelpCircle,
 Users,
 Ticket,
 Gauge,
 Palette,
 Book,
 RefreshCcw,
 PanelLeftOpen,
 PanelLeftClose,
 LogOut,
} from "lucide-react";

interface NavItem {
 label: string;
 href: string;
 icon: React.ComponentType<{ className?: string }>;
 adminOnly?: boolean;
}

const NAV_GROUPS: { label: string; emoji: string; items: NavItem[] }[] = [
  {
    label: "Primary",
    emoji: "🏠",
    items: [
      { label: "Home", href: "/dashboard", icon: Home },
      { label: "Jobs", href: "/jobs", icon: Briefcase },
      { label: "Apply Wizard", href: "/apply-wizard", icon: Wand2 },
      { label: "Stats", href: "/stats", icon: BarChart3 },
    ],
  },
  {
    label: "Documents",
    emoji: "📄",
    items: [
      { label: "Base Resume", href: "/base-resume", icon: FileText },
      { label: "Resume Versions", href: "/resume-versions", icon: FileCheck },
      { label: "Cover Letters", href: "/cover-letters", icon: Mail },
      { label: "Claims", href: "/claims", icon: ShieldCheck },
    ],
  },
  {
    label: "Applications",
    emoji: "📋",
    items: [
      { label: "Pipeline", href: "/applications", icon: Layers },
      { label: "Role Profiles", href: "/role-profiles", icon: Target },
      { label: "Assisted Apply", href: "/assisted-apply", icon: Bot },
    ],
  },
  {
    label: "AI Tools",
    emoji: "🤖",
    items: [
      { label: "AI Review", href: "/ai-review", icon: Eye },
      { label: "AI Metrics", href: "/ai-metrics", icon: LineChart },
      { label: "AI Config", href: "/ai-config", icon: Settings2 },
      { label: "AI Learning", href: "/ai-learning", icon: Brain },
      { label: "Feedback", href: "/feedback", icon: MessageSquare },
    ],
  },
  {
    label: "Other",
    emoji: "📦",
    items: [
      { label: "Freelance", href: "/freelance", icon: Handshake },
      { label: "Trends", href: "/trends", icon: TrendingUp },
      { label: "Resources", href: "/resources", icon: BookOpen },
    ],
  },
  {
    label: "Settings",
    emoji: "⚙️",
    items: [
      { label: "Account", href: "/account", icon: UserCircle },
      { label: "Guide", href: "/guide", icon: HelpCircle },
    ],
  },
  {
    label: "Admin",
    emoji: "🔒",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, adminOnly: true },
      { label: "Invite Codes", href: "/admin/invite-codes", icon: Ticket, adminOnly: true },
      { label: "Usage Limits", href: "/admin/usage-limits", icon: Gauge, adminOnly: true },
      { label: "UI Shell", href: "/admin/ui-shell", icon: Palette, adminOnly: true },
      { label: "Reset App", href: "/admin/reset", icon: RefreshCcw, adminOnly: true },
      { label: "Admin Docs", href: "/admin/docs", icon: Book, adminOnly: true },
    ],
  },
];

export function FloatingSidebar() {
  const [expanded, setExpanded] = useState(true);
 const location = useLocation();
 const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const isAnyActive = NAV_GROUPS.some((group) =>
    group.items.some(
      (item) =>
        location.pathname === item.href ||
        location.pathname.startsWith(item.href + "/")
    )
  );

 return (
 <>
 {/* Backdrop overlay when expanded on mobile-like widths */}
 {expanded && (
 <div
 className="fixed inset-0 z-40 bg-black/20 md:hidden"
 onClick={() => setExpanded(false)}
 />
 )}

  <aside
        className={cn(
          "fixed left-3 top-1/2 -translate-y-1/2 z-50",
          "hidden md:flex flex-col",
          "bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]",
          "transition-all duration-300 ease-in-out",
          "max-h-[calc(100vh-1.5rem)] overflow-y-auto no-scrollbar",
          expanded ? "w-60" : "w-[68px]"
        )}
      >
 {/* Logo area */}
 <div
  className={cn(
  "flex items-center py-4 relative",
  expanded ? "px-4 gap-3" : "justify-center"
  )}
 >
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold text-sm shrink-0 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]">
    JO
  </div>
  {expanded && (
  <span className="font-extrabold text-foreground text-base whitespace-nowrap">
  Job Ops
  </span>
  )}
  {!expanded && isAnyActive && (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
  )}
  </div>

 {/* Divider */}
 <div className="h-px bg-border mx-3" />

 {/* Nav groups */}
 <nav className="flex-1 py-3 space-y-5">
 {NAV_GROUPS.map((group) => {
 const items = group.items.filter(
 (item) => !item.adminOnly || isAdmin
 );
 if (items.length === 0) return null;

 return (
 <div key={group.label} className="px-2">
 {expanded && (
            <h3 className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              {group.emoji} {group.label}
            </h3>
 )}
 {items.map((item) => {
 const isActive =
 location.pathname === item.href ||
 location.pathname.startsWith(item.href + "/");
 return (
 <NavLink
 key={item.href}
 to={item.href}
  className={cn(
    "flex items-center rounded-xl transition-all duration-200 mb-0.5",
    expanded ? "gap-3 px-3 py-2.5" : "justify-center py-2.5",
                isActive
                  ? "bg-primary text-primary-foreground font-bold shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)] animate-[pulse-glow_3s_ease-in-out_infinite]"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
  )}
 >
 <item.icon className="h-5 w-5 shrink-0" />
 {expanded && (
 <span className="text-sm whitespace-nowrap">
 {item.label}
 </span>
 )}
 </NavLink>
 );
 })}
 </div>
 );
 })}
 </nav>

 {/* Divider */}
 <div className="h-px bg-border mx-3" />

 {/* Bottom items */}
 <div className="px-2 py-3 space-y-1">
 {/* Expand/Collapse toggle */}
 <button
 onClick={() => setExpanded(!expanded)}
 className={cn(
 "flex items-center rounded-xl transition-colors w-full",
 expanded ? "gap-3 px-3 py-2.5" : "justify-center py-2.5",
 "text-muted-foreground hover:bg-surface hover:text-foreground"
 )}
 >
 {expanded ? (
 <PanelLeftClose className="h-5 w-5 shrink-0" />
 ) : (
 <PanelLeftOpen className="h-5 w-5 shrink-0" />
 )}
 {expanded && (
 <span className="text-sm whitespace-nowrap">Collapse</span>
 )}
 </button>

 {/* Logout */}
 <button
 onClick={() => logout()}
 className={cn(
 "flex items-center rounded-xl transition-colors w-full",
 expanded ? "gap-3 px-3 py-2.5" : "justify-center py-2.5",
 "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 )}
 >
 <LogOut className="h-5 w-5 shrink-0" />
 {expanded && (
 <span className="text-sm whitespace-nowrap">Log out</span>
 )}
 </button>
 </div>
 </aside>
 </>
 );
}
