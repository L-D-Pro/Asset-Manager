import {
 Sidebar as SidebarComponent,
 SidebarContent,
 SidebarFooter,
 SidebarHeader,
 SidebarMenu,
 SidebarMenuItem,
 SidebarMenuButton,
 SidebarGroup,
 SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
 Collapsible,
 CollapsibleTrigger,
 CollapsibleContent,
} from "@/components/ui/collapsible";
import { NavLink } from "react-router-dom";
import {
 LayoutDashboard,
 Briefcase,
 FileText,
 CheckSquare,
 MessageSquare,
 UserCircle,
 Activity,
 FileCode,
 BookOpen,
 LogOut,
 User,
 ScrollText,
 Brain,
 MousePointerClick,
 Handshake,
 Sparkles,
 Shield,
 Ticket,
 BarChart3,
 TrendingUp,
 ChevronDown,
 Heart,
 LayoutTemplate,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useResolvedUiConfig } from "@/ui-shell/use-ui-shell-config";
import { SetupProgress } from "@/components/onboarding/setup-progress";

const ENABLE_APPLY_WIZARD = import.meta.env.VITE_ENABLE_APPLY_WIZARD === "true";

interface NavItem {
 name: string;
 href: string;
 icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
 label: string;
 icon: React.ComponentType<{ className?: string }>;
 items: NavItem[];
}

export function Sidebar() {
 const { user, logout } = useAuth();
 const isAdmin = user?.role === "admin";
 const [openGroup, setOpenGroup] = useState<string | null>(null);
 const uiConfig = useResolvedUiConfig();
 const [documentsOpen, setDocumentsOpen] = useState(false);
 const [aiToolsOpen, setAiToolsOpen] = useState(false);
 const [freelanceOpen, setFreelanceOpen] = useState(false);

 const featuredCardRegistry: Record<
 string,
 {
 href: string;
 subtitle: string;
 icon: React.ComponentType<{ className?: string }>;
 activeClass: string;
 idleClass: string;
 iconColor: string;
 }
 > = {
 "nav-dashboard": {
 href: "/dashboard",
 subtitle: "Overview & stats",
 icon: LayoutDashboard,
 activeClass: "bg-sidebar-primary/16 border-sidebar-primary/45 shadow-sm",
 idleClass: "bg-sidebar-accent/28 border-sidebar-border hover:border-sidebar-primary/35 hover:bg-sidebar-accent/42",
 iconColor: "text-sidebar-primary",
 },
 "nav-wizard": {
 href: "/apply-wizard",
 subtitle: "AI-powered apply",
 icon: Sparkles,
 activeClass: "bg-sidebar-primary/16 border-sidebar-primary/45 shadow-sm",
 idleClass: "bg-sidebar-accent/28 border-sidebar-border hover:border-sidebar-primary/35 hover:bg-sidebar-accent/42",
 iconColor: "text-sidebar-primary",
 },
 "nav-trends": {
 href: "/trends",
 subtitle: "Market insights",
 icon: TrendingUp,
 activeClass: "bg-sidebar-primary/16 border-sidebar-primary/45 shadow-sm",
 idleClass: "bg-sidebar-accent/28 border-sidebar-border hover:border-sidebar-primary/35 hover:bg-sidebar-accent/42",
 iconColor: "text-sidebar-primary",
 },
 "nav-resources": {
 href: "/resources",
 subtitle: "Free tools & support",
 icon: Heart,
 activeClass: "bg-sidebar-primary/16 border-sidebar-primary/45 shadow-sm",
 idleClass: "bg-sidebar-accent/28 border-sidebar-border hover:border-sidebar-primary/35 hover:bg-sidebar-accent/42",
 iconColor: "text-sidebar-primary",
 },
 };

 const featuredItems = uiConfig.slots.navbar
 .filter((item) => item.visibility)
 .sort((a, b) => a.order - b.order)
 .filter((item) => item.componentKey !== "nav-wizard" || ENABLE_APPLY_WIZARD)
 .flatMap((item) => {
 const meta = featuredCardRegistry[item.componentKey];
 return meta ? [{ item, meta }] : [];
 });

 const primaryItems: NavItem[] = [
 { name: "Jobs Pipeline", href: "/jobs", icon: Briefcase },
 { name: "Applications", href: "/applications", icon: CheckSquare },
 { name: "Base Resume", href: "/base-resume", icon: ScrollText },
 ...(ENABLE_APPLY_WIZARD ? [{ name: "Apply Wizard", href: "/apply-wizard", icon: Sparkles }] : []),
 ];

 const collapsibleGroups: NavGroup[] = [
 {
 label: "Documents",
 icon: FileText,
 items: [
 { name: "Claims Ledger", href: "/claims", icon: CheckSquare },
 { name: "Resumes Queue", href: "/resume-versions", icon: FileText },
 { name: "Cover Letters Queue", href: "/cover-letters", icon: MessageSquare },
 ],
 },
 {
 label: "AI Tools",
 icon: Brain,
 items: [
 { name: "AI Review", href: "/ai-review", icon: Brain },
 { name: "AI Metrics", href: "/ai-metrics", icon: Activity },
 { name: "AI Config", href: "/ai-config", icon: Activity },
 { name: "AI Learning", href: "/ai-learning", icon: Brain },
 ],
 },
 {
 label: "Freelance",
 icon: Handshake,
 items: [
 { name: "Freelance Assist", href: "/freelance", icon: Handshake },
 ],
 },
 ];

 const handleLogout = async () => {
 await logout();
 window.location.replace("/login");
 };

 return (
 <SidebarComponent className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
 <SidebarHeader className="p-4 border-b border-sidebar-border">
 <h2 className="text-lg font-bold tracking-tight flex items-center gap-2.5 text-sidebar-foreground">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/20">
 <FileCode className="h-4 w-4 text-sidebar-primary" />
 </div>
 <span>Job Ops</span>
 </h2>
 </SidebarHeader>
 <SidebarContent>
 <SidebarMenu>
 {/* Featured cards */}
 <div className="px-3 pt-2 space-y-1.5">
 {featuredItems.map(({ item, meta }) => {
 const Icon = meta.icon;
 const textColor = "text-sidebar-foreground";
 const subtitleColor = "text-sidebar-foreground/60";
 return (
 <NavLink to={meta.href} className="contents" key={item.id}>
 {({ isActive }) => (
 <div
 className={cn(
 "relative rounded-md border transition-all duration-200 cursor-pointer",
 isActive ? meta.activeClass : meta.idleClass
 )}
 >
 <div className="flex items-center gap-3 px-3 py-2.5">
 <div className={cn(
 "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300",
 isActive ? "bg-sidebar-primary/16" : "bg-sidebar-foreground/5"
 )}>
 <Icon className={cn("h-4 w-4", meta.iconColor)} />
 </div>
 <div>
 <span className={cn("font-semibold text-sm", textColor)}>{item.label}</span>
 <p className={cn("text-[10px] leading-tight", subtitleColor)}>{meta.subtitle}</p>
 </div>
 </div>
 </div>
 )}
 </NavLink>
 );
 })}
 </div>

 {/* Divider after featured cards */}
 <div className="px-3 pt-3 pb-1">
 <div className="h-px bg-sidebar-border" />
 </div>
 </SidebarMenu>

 <SetupProgress />

 {/* Primary nav items */}
 <SidebarMenu className="px-3 pt-2 space-y-0.5">
 {primaryItems.map((item) => (
 <SidebarMenuItem key={item.name}>
 <NavLink to={item.href} className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip={item.name} size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <item.icon
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">{item.name}</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 ))}
 </SidebarMenu>

 {/* Thin divider below primary */}
 <div className="px-3 pt-3 pb-1">
 <div className="h-px bg-sidebar-border" />
 </div>

 {/* Secondary collapsible groups */}
 {collapsibleGroups.map((group) => {
 const stateMap: Record<string, { open: boolean; setOpen: (v: boolean) => void }> = {
 Documents: { open: documentsOpen, setOpen: setDocumentsOpen },
 "AI Tools": { open: aiToolsOpen, setOpen: setAiToolsOpen },
 Freelance: { open: freelanceOpen, setOpen: setFreelanceOpen },
 };
 const { open: isOpen, setOpen } = stateMap[group.label] ?? { open: false, setOpen: () => {} };
 return (
 <Collapsible key={group.label} open={isOpen} onOpenChange={setOpen} className="px-3">
 <SidebarGroup>
 <CollapsibleTrigger asChild>
 <div className="flex w-full items-center justify-between cursor-pointer py-1">
 <SidebarGroupLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-sidebar-foreground/60 font-semibold cursor-pointer select-none">
 <group.icon className="h-3 w-3 text-sidebar-primary" />
 <span>{group.label}</span>
 </SidebarGroupLabel>
 <ChevronDown
 className={cn(
 "h-3.5 w-3.5 text-sidebar-foreground/60 shrink-0 transition-transform duration-200",
 isOpen && "rotate-180"
 )}
 />
 </div>
 </CollapsibleTrigger>
 <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
 <SidebarMenu className="mt-1">
 {group.items.map((item) => (
 <SidebarMenuItem key={item.name}>
 <NavLink to={item.href} className="contents">
 {({ isActive }) => (
 <SidebarMenuButton
 tooltip={item.name}
 size="sm"
 asChild
 >
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <item.icon
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">{item.name}</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 ))}
 </SidebarMenu>
 </CollapsibleContent>
 </SidebarGroup>
 </Collapsible>
 );
 })}

 {/* Settings group */}
 <Collapsible
 open={openGroup === "Settings"}
 onOpenChange={(open) => setOpenGroup(open ? "Settings" : null)}
 className="px-3"
 >
 <SidebarGroup>
 <CollapsibleTrigger asChild>
 <div className="flex w-full items-center justify-between cursor-pointer py-1">
 <SidebarGroupLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-sidebar-foreground/60 font-semibold cursor-pointer select-none">
 <UserCircle className="h-3 w-3 text-sidebar-primary" />
 <span>Settings</span>
 </SidebarGroupLabel>
 <ChevronDown
 className={cn(
 "h-3.5 w-3.5 text-sidebar-foreground/60 shrink-0 transition-transform duration-200",
 openGroup === "Settings" && "rotate-180"
 )}
 />
 </div>
 </CollapsibleTrigger>
 <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
 <SidebarMenu className="mt-1">
 <SidebarMenuItem>
 <NavLink to="/account" className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip="Account" size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <User
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">Account</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 <SidebarMenuItem>
 <NavLink to="/guide" className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip="Help & Tips" size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <BookOpen
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">Help & Tips</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 </SidebarMenu>
 </CollapsibleContent>
 </SidebarGroup>
 </Collapsible>

 {isAdmin && (
 <>
 <div className="px-3 py-3">
 <div className="h-px bg-sidebar-border" />
 </div>
 <div className="px-3">
 <SidebarGroup>
 <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 font-semibold">
 Admin
 </SidebarGroupLabel>
 <SidebarMenu className="mt-1">
 <SidebarMenuItem>
 <NavLink to="/admin/users" className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip="User Management" size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <Shield
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">User Management</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 <SidebarMenuItem>
 <NavLink to="/admin/invite-codes" className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip="Invite Codes" size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <Ticket
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">Invite Codes</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 <SidebarMenuItem>
 <NavLink to="/admin/usage-limits" className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip="Usage Limits" size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <BarChart3
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">Usage Limits</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 <SidebarMenuItem>
 <NavLink to="/admin/ui-shell" className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip="UI Shell" size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <LayoutTemplate
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">UI Shell</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 <SidebarMenuItem>
 <NavLink to="/admin/docs" className="contents">
 {({ isActive }) => (
 <SidebarMenuButton tooltip="Admin Docs" size="sm" asChild>
 <span
 className={cn(
 "flex items-center gap-2.5 cursor-pointer pl-5 pr-2 py-1.5 rounded-r-lg transition-all duration-200 border-l-2",
 isActive
 ? "text-sidebar-foreground bg-sidebar-primary/15 border-sidebar-primary font-medium"
 : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border-transparent"
 )}
 >
 <BookOpen
 className={cn(
 "h-3.5 w-3.5",
 isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
 )}
 />
 <span className="text-sm">Admin Docs</span>
 </span>
 </SidebarMenuButton>
 )}
 </NavLink>
 </SidebarMenuItem>
 </SidebarMenu>
 </SidebarGroup>
 </div>
 </>
 )}
 </SidebarContent>
 <SidebarFooter className="border-t border-sidebar-border p-2">
 <SidebarMenu>
 <SidebarMenuItem>
 <SidebarMenuButton tooltip="Sign out" asChild onClick={handleLogout}>
 <span className="flex items-center gap-3 cursor-pointer text-sidebar-foreground/65 hover:text-sidebar-foreground transition-colors px-3">
 <LogOut className="h-4 w-4" />
 <span>Sign out</span>
 </span>
 </SidebarMenuButton>
 </SidebarMenuItem>
 </SidebarMenu>
 </SidebarFooter>
 </SidebarComponent>
 );
}
