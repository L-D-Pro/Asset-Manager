import { Sidebar as SidebarComponent, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, FileText, CheckSquare, MessageSquare, Settings, UserCircle, Activity, ChevronRight, FileCode } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
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
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                  <Link href={item.href} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </SidebarComponent>
  );
}
