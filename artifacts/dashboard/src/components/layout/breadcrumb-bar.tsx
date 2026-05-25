import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles, Search, Zap, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme";

function humanise(segment: string): string {
  if (!segment) return "";
  if (segment === "ai-config") return "Prompt versions";
  if (segment === "ai-review") return "Review queue";
  if (segment === "ai-learning") return "AI learning";
  if (segment === "ai-metrics") return "Models";
  if (segment === "base-resume") return "Base resume";
  if (segment === "resume-versions") return "Resume review";
  if (segment === "cover-letters") return "Cover letters";
  if (segment === "apply-wizard") return "Apply";
  if (segment === "job-board") return "Job board";
  if (segment === "role-profiles") return "Role profiles";
  if (segment === "pipeline-diagram") return "Pipeline diagram";
  return segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const ACCENT_SWATCHES = [
  { name: "lime" as const,   hex: "#B4F03E" },
  { name: "pink" as const,   hex: "#FF3D7F" },
  { name: "cyan" as const,   hex: "#4FD1FF" },
  { name: "violet" as const, hex: "#8E7DFF" },
];

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { theme, accent, setTheme, setAccent } = useTheme();

  return (
    <div className="settings-pop">
      <div className="settings-h">
        <span className="settings-title">Preferences</span>
        <button className="settings-x" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-label">Theme</div>
        <div className="settings-sublabel">Mode</div>
        <div className="seg">
          <button
            className={`seg-btn ${theme !== "light" ? "active" : ""}`}
            onClick={() => setTheme("dark")}>
            <Moon size={12} strokeWidth={2}/> Arena
          </button>
          <button
            className={`seg-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}>
            <Sun size={12} strokeWidth={2}/> Daylight
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-label">Accent</div>
        <div className="settings-sublabel">Neon color</div>
        <div className="swatches">
          {ACCENT_SWATCHES.map(s => (
            <button
              key={s.name}
              className={`swatch ${accent === s.name ? "active" : ""}`}
              style={{ background: s.hex }}
              onClick={() => setAccent(s.name)}
              aria-label={s.name}
              title={s.name}>
              {accent === s.name && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BreadcrumbBar() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const crumbs = segments.map(humanise);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme !== "light";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [settingsOpen]);

  return (
    <div className="topbar">
      <div className="crumbs">
        <Link to="/dashboard" style={{ cursor: "pointer" }}>
          job-ops
        </Link>
        {crumbs.map((c, i) => (
          <span key={i}>
            <span className="sep">/</span>
            <span className={i === crumbs.length - 1 ? "here" : ""}>{c}</span>
          </span>
        ))}
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        <div className="search" style={{ minWidth: 220 }}>
          <Search size={13} strokeWidth={1.8} />
          <input placeholder="Search anything…" />
          <span className="kbd">&#x2318;K</span>
        </div>
        <span className="hint">
          <Zap size={11} strokeWidth={1.8} /> <span className="mono" style={{ color: "var(--gold)" }}>2.4k</span> XP today
        </span>
        <Link to="/chat" className="btn ghost sm">
          <Sparkles size={13} strokeWidth={1.8} />
          Run AI<span className="kbd">&#x2318;J</span>
        </Link>
        <button
          className="btn ghost sm theme-toggle"
          onClick={toggleTheme}
          title={isDark ? "Switch to Daylight" : "Switch to Arena"}
          aria-label="Toggle theme">
          <span className="theme-toggle-track" data-dark={String(isDark)}>
            <span className="theme-toggle-thumb">
              {isDark
                ? <Moon size={7} strokeWidth={2.5}/>
                : <Sun size={7} strokeWidth={2.5}/>}
            </span>
          </span>
          <span className="theme-toggle-label">{isDark ? "Arena" : "Daylight"}</span>
        </button>
        <div ref={settingsRef} style={{ position: "relative" }}>
          <button
            className={`btn ghost sm ${settingsOpen ? "active" : ""}`}
            onClick={() => setSettingsOpen(o => !o)}
            aria-label="Preferences">
            <Settings size={13} strokeWidth={1.8} />
          </button>
          {settingsOpen && (
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
}
