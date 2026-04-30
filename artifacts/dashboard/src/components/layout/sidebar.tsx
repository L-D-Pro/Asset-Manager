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
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/utils";
import { useState } from "react";

const ENABLE_APPLY_WIZARD = import.meta.env.VITE_ENABLE_APPLY_WIZARD === "true";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  items: NavItem[];
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const navGroups: NavGroup[] = [
    {
      label: "Jobs",
      icon: Briefcase,
      accent: "text-blue-400",
      items: [
        { name: "Jobs Pipeline", href: "/jobs", icon: Briefcase },
        { name: "Applications", href: "/applications", icon: CheckSquare },
        { name: "Assisted Apply", href: "/assisted-apply", icon: MousePointerClick },
        { name: "Role Profiles", href: "/role-profiles", icon: UserCircle },
      ],
    },
    {
      label: "Documents",
      icon: FileText,
      accent: "text-teal-400",
      items: [
        { name: "Base Resume", href: "/base-resume", icon: ScrollText },
        { name: "Claims Ledger", href: "/claims", icon: CheckSquare },
        { name: "Resumes Queue", href: "/resume-versions", icon: FileText },
        { name: "Cover Letters Queue", href: "/cover-letters", icon: MessageSquare },
      ],
    },
    {
      label: "AI Tools",
      icon: Brain,
      accent: "text-fuchsia-400",
      items: [
        { name: "AI Review", href: "/ai-review", icon: Brain },
        { name: "AI Metrics", href: "/ai-metrics", icon: Activity },
        { name: "AI Config", href: "/ai-config", icon: Activity },
        { name: "AI Learning", href: "/ai-learning", icon: Brain },
        { name: "Feedback Signals", href: "/feedback", icon: Activity },
      ],
    },
    {
      label: "Freelance",
      icon: Handshake,
      accent: "text-amber-400",
      items: [
        { name: "Freelance Assist", href: "/freelance", icon: Handshake },
      ],
    },
    {
      label: "Settings",
      icon: UserCircle,
      accent: "text-slate-400",
      items: [
        { name: "Account", href: "/account", icon: User },
        { name: "Help & Tips", href: "/guide", icon: BookOpen },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.replace("/login");
  };

  return (
    <SidebarComponent className="border-r border-slate-800 bg-slate-950">
      <SidebarHeader className="p-4 border-b border-slate-800">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2.5 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
            <FileCode className="h-4 w-4 text-indigo-400" />
          </div>
          <span>Job Ops</span>
        </h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {/* Featured cards with glass-morphism hover effect */}
          <div className="px-3 pt-2 space-y-5">
            <NavLink to="/dashboard" className="contents">
              {({ isActive }) => (
                <div
                  className={cn(
                    "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                    isActive
                      ? "bg-indigo-500/20 border-indigo-500/60 shadow-lg shadow-indigo-500/15"
                        : "bg-white/[0.23] border-white/[0.20] hover:border-white/35 hover:bg-white/[0.31] hover:shadow-md hover:shadow-indigo-500/5"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.06] to-violet-500/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-3 px-3 py-2.5">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300",
                      isActive ? "bg-indigo-500/30" : "bg-indigo-500/15 group-hover:bg-indigo-500/25"
                    )}>
                      <LayoutDashboard className={cn("h-4 w-4", isActive ? "text-indigo-300" : "text-indigo-400")} />
                    </div>
                    <div>
                      <span className={cn("font-semibold text-sm", isActive ? "text-white" : "text-slate-200")}>Dashboard</span>
                      <p className="text-[10px] text-slate-400 leading-tight">Overview & stats</p>
                    </div>
                  </div>
                </div>
              )}
            </NavLink>
            {ENABLE_APPLY_WIZARD && (
              <NavLink to="/apply-wizard" className="contents">
                {({ isActive }) => (
                  <div
                    className={cn(
                      "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                      isActive
                        ? "bg-indigo-500/20 border-indigo-500/60 shadow-lg shadow-indigo-500/15"
                        : "bg-white/[0.20] border-white/[0.20] hover:border-white/35 hover:bg-white/[0.28] hover:shadow-md hover:shadow-indigo-500/5"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.06] to-violet-500/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-center gap-3 px-3 py-2.5">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300",
                        isActive ? "bg-indigo-500/30" : "bg-indigo-500/15 group-hover:bg-indigo-500/25"
                      )}>
                        <Sparkles className={cn("h-4 w-4", isActive ? "text-indigo-300" : "text-indigo-400")} />
                      </div>
                      <div>
                        <span className={cn("font-semibold text-sm", isActive ? "text-white" : "text-slate-200")}>Wizard</span>
                        <p className="text-[10px] text-slate-400 leading-tight">AI-powered apply</p>
                      </div>
                    </div>
                  </div>
                )}
              </NavLink>
            )}
            <NavLink to="/trends" className="contents">
              {({ isActive }) => (
                <div
                  className={cn(
                    "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                    isActive
                      ? "bg-blue-500/20 border-blue-500/60 shadow-lg shadow-blue-500/15"
                        : "bg-white/[0.26] border-white/[0.20] hover:border-white/35 hover:bg-white/[0.34] hover:shadow-md hover:shadow-blue-500/5"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.06] to-teal-500/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-3 px-3 py-2.5">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300",
                      isActive ? "bg-blue-500/30" : "bg-blue-500/15 group-hover:bg-blue-500/25"
                    )}>
                      <TrendingUp className={cn("h-4 w-4", isActive ? "text-blue-300" : "text-blue-400")} />
                    </div>
                    <div>
                      <span className={cn("font-semibold text-sm", isActive ? "text-white" : "text-slate-200")}>Trends</span>
                      <p className="text-[10px] text-slate-400 leading-tight">Market insights</p>
                    </div>
                  </div>
                </div>
              )}
            </NavLink>
            <NavLink to="/resources" className="contents">
              {({ isActive }) => (
                <div
                  className={cn(
                    "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                    isActive
                      ? "bg-emerald-500/20 border-emerald-500/60 shadow-lg shadow-emerald-500/15"
                        : "bg-white/[0.29] border-white/[0.20] hover:border-white/35 hover:bg-white/[0.37] hover:shadow-md hover:shadow-emerald-500/5"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.06] to-teal-500/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-3 px-3 py-2.5">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300",
                      isActive ? "bg-emerald-500/30" : "bg-emerald-500/15 group-hover:bg-emerald-500/25"
                    )}>
                      <Heart className={cn("h-4 w-4", isActive ? "text-emerald-300" : "text-emerald-400")} />
                    </div>
                    <div>
                      <span className={cn("font-semibold text-sm", isActive ? "text-white" : "text-slate-200")}>Resources</span>
                      <p className="text-[10px] text-slate-400 leading-tight">Free tools & support</p>
                    </div>
                  </div>
                </div>
              )}
            </NavLink>
          </div>

          {/* Divider after featured cards */}
          <div className="px-3 pt-3 pb-1">
            <div className="h-px bg-slate-800" />
          </div>
        </SidebarMenu>

        {navGroups.map((group) => {
          const isOpen = openGroup === group.label;
          return (
            <Collapsible
              key={group.label}
              open={isOpen}
              onOpenChange={(open) => setOpenGroup(open ? group.label : null)}
              className="px-3"
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <div className="flex w-full items-center justify-between cursor-pointer py-1">
                    <SidebarGroupLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-semibold cursor-pointer select-none">
                      <group.icon className={cn("h-3 w-3", group.accent)} />
                      <span>{group.label}</span>
                    </SidebarGroupLabel>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-slate-500 shrink-0 transition-transform duration-200",
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
                                    ? "text-white bg-indigo-500/10 border-indigo-500 font-medium"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent"
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    isActive ? "text-indigo-400" : "text-slate-500"
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

        {isAdmin && (
          <>
            <div className="px-3 py-3">
              <div className="h-px bg-slate-800" />
            </div>
            <div className="px-3">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
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
                                ? "text-white bg-indigo-500/10 border-indigo-500 font-medium"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent"
                            )}
                          >
                            <Shield
                              className={cn(
                                "h-3.5 w-3.5",
                                isActive ? "text-indigo-400" : "text-slate-500"
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
                                ? "text-white bg-indigo-500/10 border-indigo-500 font-medium"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent"
                            )}
                          >
                            <Ticket
                              className={cn(
                                "h-3.5 w-3.5",
                                isActive ? "text-indigo-400" : "text-slate-500"
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
                                ? "text-white bg-indigo-500/10 border-indigo-500 font-medium"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent"
                            )}
                          >
                            <BarChart3
                              className={cn(
                                "h-3.5 w-3.5",
                                isActive ? "text-indigo-400" : "text-slate-500"
                              )}
                            />
                            <span className="text-sm">Usage Limits</span>
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
                                ? "text-white bg-indigo-500/10 border-indigo-500 font-medium"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent"
                            )}
                          >
                            <BookOpen
                              className={cn(
                                "h-3.5 w-3.5",
                                isActive ? "text-indigo-400" : "text-slate-500"
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
      <SidebarFooter className="border-t border-slate-800 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" asChild onClick={handleLogout}>
              <span className="flex items-center gap-3 cursor-pointer text-slate-500 hover:text-slate-300 transition-colors px-3">
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
