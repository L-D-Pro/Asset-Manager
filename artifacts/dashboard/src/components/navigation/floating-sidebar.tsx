import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Wand2,
  Trophy,
  User,
  Settings,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/apply-wizard", label: "Apply", icon: Wand2 },
  { path: "/stats", label: "Stats", icon: Trophy },
  { path: "/account", label: "Profile", icon: User },
];

const BOTTOM_ITEMS = [
  { path: "/guide", label: "Settings", icon: Settings },
];

function SidebarItem({
  path,
  label,
  icon: Icon,
}: {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={path}
          className={({ isActive }) =>
            cn(
              "relative flex items-center justify-center w-12 h-12 rounded-full transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )
          }
        >
          <Icon className="w-6 h-6" />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function FloatingSidebar() {
  return (
    <aside className="hidden md:flex flex-col fixed top-4 left-4 bottom-4 w-[72px] items-center py-4 card-chunky shadow-lg z-50">
      <nav className="flex flex-col items-center gap-2 flex-1">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.path} {...item} />
        ))}
      </nav>

      <div className="w-8 h-px bg-border my-2" />

      <nav className="flex flex-col items-center gap-2">
        {BOTTOM_ITEMS.map((item) => (
          <SidebarItem key={item.path} {...item} />
        ))}
      </nav>
    </aside>
  );
}
