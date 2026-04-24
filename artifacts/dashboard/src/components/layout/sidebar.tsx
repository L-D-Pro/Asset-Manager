import { Sidebar as SidebarComponent, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Briefcase, FileText, CheckSquare, MessageSquare, Settings, UserCircle, Activity, FileCode, BookOpen, LogOut, User, ScrollText, Brain, MousePointerClick, Handshake, Sparkles } from "lucide-react";
import { useAuth } from "@/context/auth";

const ENABLE_APPLY_WIZARD = import.meta.env.VITE_ENABLE_APPLY_WIZARD === "true";

export function Sidebar() {
  const { user, logout } = useAuth();

  const navigation = [
    ...(ENABLE_APPLY_WIZARD ? [{ name: "Wizard", href: "/apply-wizard", icon: Sparkles }] : []),
    { name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
    { name: "Jobs Pipeline", href: "/jobs", icon: Briefcase },
    { name: "Applications", href: "/applications", icon: Activity },
    { name: "Assisted Apply", href: "/assisted-apply", icon: MousePointerClick },
    { name: "Freelance Copilot", href: "/freelance", icon: Handshake },
    { name: "Claims Ledger", href: "/claims", icon: CheckSquare },
    { name: "Base Resume", href: "/base-resume", icon: ScrollText },
    { name: "Resumes (Queue)", href: "/resume-versions", icon: FileText },
    { name: "Cover Letters (Queue)", href: "/cover-letters", icon: MessageSquare },
    { name: "Feedback Signals", href: "/feedback", icon: Activity },
    { name: "Role Profiles", href: "/role-profiles", icon: UserCircle },
    { name: "AI Review", href: "/ai-review", icon: Brain },
    { name: "AI Metrics", href: "/ai-metrics", icon: Activity },
    { name: "AI Config", href: "/ai-config", icon: Settings },
    { name: "Guide", href: "/guide", icon: BookOpen },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.replace("/login");
  };

  return (
    <SidebarComponent className="border-r bg-sidebar">
      <SidebarHeader className="p-4 border-b">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <FileCode className="h-5 w-5 text-primary" />
          <span>Job Ops</span>
        </h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navigation.map((item) => (
            <SidebarMenuItem key={item.name}>
              <NavLink
                to={item.href}
                end={item.exact}
                className="contents"
              >
                {({ isActive }) => (
                  <SidebarMenuButton isActive={isActive} tooltip={item.name} asChild>
                    <span className="flex items-center gap-3 cursor-pointer">
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </span>
                  </SidebarMenuButton>
                )}
              </NavLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <NavLink to="/account" className="contents">
              {({ isActive }) => (
                <SidebarMenuButton isActive={isActive} tooltip="Account" asChild>
                  <span className="flex items-center gap-3 cursor-pointer">
                    <User className="h-4 w-4" />
                    <span className="flex-1 text-sm">{user?.username ?? "Account"}</span>
                  </span>
                </SidebarMenuButton>
              )}
            </NavLink>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" asChild onClick={handleLogout}>
              <span className="flex items-center gap-3 cursor-pointer text-muted-foreground hover:text-foreground">
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
