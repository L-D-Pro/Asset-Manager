import { NavLink } from "react-router-dom";
import {
 LayoutDashboard,
 Briefcase,
 Wand2,
 Trophy,
 User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
 { path: "/dashboard", label: "Home", icon: LayoutDashboard },
 { path: "/jobs", label: "Jobs", icon: Briefcase },
 { path: "/apply-wizard", label: "Apply", icon: Wand2, highlighted: true },
 { path: "/stats", label: "Stats", icon: Trophy },
 { path: "/account", label: "Profile", icon: User },
];

export function BottomNav() {
 return (
 <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t-4 border-t-[hsl(var(--border))] z-50 flex items-center justify-around px-2">
 {NAV_ITEMS.map(({ path, label, icon: Icon, highlighted }) => (
 <NavLink
 key={path}
 to={path}
 className={({ isActive }) =>
 cn(
 "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1",
 isActive ? "text-primary" : "text-muted-foreground"
 )
 }
 >
 {({ isActive }) => (
 <>
 <div
 className={cn(
 "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
 highlighted && !isActive && "bg-primary text-primary-foreground",
 highlighted && isActive && "bg-primary text-primary-foreground",
 !highlighted && isActive && "text-primary",
 !highlighted && !isActive && "text-muted-foreground"
 )}
 >
 <Icon className="w-6 h-6" />
 </div>
 <span className="text-[10px] leading-none">{label}</span>
 </>
 )}
 </NavLink>
 ))}
 </nav>
 );
}
