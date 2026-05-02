import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
 LayoutDashboard,
 Briefcase,
 Wand2,
 Trophy,
 User,
 Settings,
 Plus,
 Search,
 FileText,
 BarChart3,
 Brain,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RouteItem {
 path: string;
 label: string;
 section: "Pages" | "Actions";
 icon: LucideIcon;
 keywords?: string[];
}

const ROUTES: RouteItem[] = [
 { path: "/dashboard", label: "Home", section: "Pages", icon: LayoutDashboard, keywords: ["dashboard", "overview"] },
 { path: "/jobs", label: "Jobs Pipeline", section: "Pages", icon: Briefcase, keywords: ["jobs", "pipeline", "positions"] },
 { path: "/apply-wizard", label: "Apply Wizard", section: "Pages", icon: Wand2, keywords: ["apply", "wizard", "tailor"] },
 { path: "/stats", label: "Stats", section: "Pages", icon: Trophy, keywords: ["stats", "statistics", "trophy"] },
 { path: "/account", label: "Account", section: "Pages", icon: User, keywords: ["account", "profile"] },
 { path: "/guide", label: "Guide", section: "Pages", icon: Settings, keywords: ["guide", "settings", "help"] },
 { path: "/claims", label: "Claims", section: "Pages", icon: FileText },
 { path: "/base-resume", label: "Base Resume", section: "Pages", icon: FileText },
 { path: "/resume-versions", label: "Resume Versions", section: "Pages", icon: FileText },
 { path: "/cover-letters", label: "Cover Letters", section: "Pages", icon: FileText },
 { path: "/applications", label: "Applications", section: "Pages", icon: FileText },
 { path: "/assisted-apply", label: "Assisted Apply", section: "Pages", icon: Wand2 },
 { path: "/freelance", label: "Freelance", section: "Pages", icon: Briefcase },
 { path: "/ai-review", label: "AI Review", section: "Pages", icon: Brain },
 { path: "/ai-metrics", label: "AI Metrics", section: "Pages", icon: BarChart3 },
 { path: "/ai-config", label: "AI Config", section: "Pages", icon: Settings },
 { path: "/ai-learning", label: "AI Learning", section: "Pages", icon: Brain },
 { path: "/role-profiles", label: "Role Profiles", section: "Pages", icon: User },
 { path: "/feedback", label: "Feedback", section: "Pages", icon: FileText },
 { path: "/trends", label: "Trends", section: "Pages", icon: BarChart3 },
 { path: "/resources", label: "Resources", section: "Pages", icon: FileText },
 { path: "/jobs", label: "Ingest New Job", section: "Actions", icon: Plus },
 { path: "/apply-wizard", label: "Start Application", section: "Actions", icon: Wand2 },
 { path: "/ai-review", label: "Review with AI", section: "Actions", icon: Brain },
 { path: "/base-resume", label: "Edit Base Resume", section: "Actions", icon: FileText },
];

const SECTIONS: Array<RouteItem["section"]> = ["Pages", "Actions"];

function highlightMatch(text: string, query: string) {
 if (!query.trim()) return text;
 const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
 const parts = text.split(regex);
 return parts.map((part, i) =>
 regex.test(part) ? (
 <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">
 {part}
 </mark>
 ) : (
 part
 )
 );
}

export function CommandPalette() {
 const [open, setOpen] = useState(false);
 const [query, setQuery] = useState("");
 const [selectedIndex, setSelectedIndex] = useState(0);
 const inputRef = useRef<HTMLInputElement>(null);
 const navigate = useNavigate();

 const filteredRoutes = ROUTES.filter((route) => {
 if (!query.trim()) return true;
 const q = query.toLowerCase();
 return (
 route.label.toLowerCase().includes(q) ||
 route.section.toLowerCase().includes(q) ||
 route.path.toLowerCase().includes(q) ||
 (route.keywords?.some((k) => k.includes(q)) ?? false)
 );
 });

 const grouped = SECTIONS.map((section) => ({
 section,
 items: filteredRoutes.filter((r) => r.section === section),
 })).filter((g) => g.items.length > 0);

 const flatResults = grouped.flatMap((g) => g.items);

 useEffect(() => {
 setSelectedIndex(0);
 }, [query]);

 useEffect(() => {
 if (open) {
 inputRef.current?.focus();
 } else {
 setQuery("");
 }
 }, [open]);

 const handleKeyDown = useCallback(
 (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === "k") {
 e.preventDefault();
 setOpen((prev) => !prev);
 return;
 }
 if (e.key === "Escape" && open) {
 setOpen(false);
 }
 },
 [open]
 );

 useEffect(() => {
 document.addEventListener("keydown", handleKeyDown);
 return () => document.removeEventListener("keydown", handleKeyDown);
 }, [handleKeyDown]);

 const selectItem = useCallback(
 (path: string) => {
 navigate(path);
 setOpen(false);
 },
 [navigate]
 );

 const handleInputKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === "ArrowDown") {
 e.preventDefault();
 setSelectedIndex((prev) => (prev + 1) % flatResults.length);
 } else if (e.key === "ArrowUp") {
 e.preventDefault();
 setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
 } else if (e.key === "Enter") {
 e.preventDefault();
 if (flatResults[selectedIndex]) {
 selectItem(flatResults[selectedIndex].path);
 }
 }
 };

 if (!open) return null;

 return (
 <div className="fixed inset-0 z-[100]">
 <div
 className="absolute inset-0 bg-black/50"
 onClick={() => setOpen(false)}
 />
 <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[520px] px-4">
  <div className="p-0 overflow-hidden">
 <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
 <Search className="w-4 h-4 text-muted-foreground shrink-0" />
 <input
 ref={inputRef}
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={handleInputKeyDown}
 placeholder="Search pages and actions..."
 className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
 />
 <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
 ESC
 </kbd>
 </div>
 <div className="max-h-[320px] overflow-y-auto">
 {grouped.map((group, gi) => (
 <div key={group.section}>
 <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
 {group.section}
 </div>
 {group.items.map((item) => {
 const flatIndex = flatResults.indexOf(item);
 const isSelected = flatIndex === selectedIndex;
 return (
 <button
 key={`${item.section}-${item.label}-${gi}`}
 onClick={() => selectItem(item.path)}
 className={cn(
 "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
 isSelected
 ? "bg-muted text-foreground"
 : "text-foreground hover:bg-muted/50"
 )}
 >
 <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
 <span>{highlightMatch(item.label, query)}</span>
 </button>
 );
 })}
 </div>
 ))}
 {flatResults.length === 0 && (
 <div className="px-4 py-8 text-center text-sm text-muted-foreground">
 No results found.
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
