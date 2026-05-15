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
      <mark key={i}>
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
    <div>
      <div onClick={() => setOpen(false)} />
      <div>
        <div>
          <div>
            <Search />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search pages and actions..."
            />
            <kbd>ESC</kbd>
          </div>
          <div>
            {grouped.map((group, gi) => (
              <div key={group.section}>
                <div>
                  {group.section}
                </div>
                {group.items.map((item) => {
                  const flatIndex = flatResults.indexOf(item);
                  return (
                    <button
                      key={`${item.section}-${item.label}-${gi}`}
                      onClick={() => selectItem(item.path)}
                    >
                      <item.icon />
                      <span>{highlightMatch(item.label, query)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {flatResults.length === 0 && (
              <div>
                No results found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
