import { Sidebar as SidebarComponent, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Briefcase, FileText, CheckSquare, MessageSquare, Settings, UserCircle, Activity, FileCode } from "lucide-react";

export function Sidebar() {
  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
    { name: "Jobs Pipeline", href: "/jobs", icon: Briefcase },
    { name: "Applications", href: "/applications", icon: Activity },
    { name: "Claims Ledger", href: "/claims", icon: CheckSquare },
    { name: "Resumes (Queue)", href: "/resume-versions", icon: FileText },
    { name: "Cover Letters (Queue)", href: "/cover-letters", icon: MessageSquare },
    { name: "Feedback Signals", href: "/feedback", icon: Activity },
    { name: "Role Profiles", href: "/role-profiles", icon: UserCircle },
    { name: "AI Config", href: "/ai-config", icon: Settings },
  ];

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
    </SidebarComponent>
  );
}
