import { useEffect } from "react";

import { FloatingSidebar } from "@/components/navigation/floating-sidebar";
import { CommandPalette } from "@/components/navigation/command-palette";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";

/**
 * Quiet Operations app shell.
 *
 * Two-column grid: 232px sidebar + 1fr main column. The main column has a
 * sticky topbar (breadcrumbs + global actions) and a scrollable page area
 * below it. No glass-morphism, no ambient orbs — the surface is warm paper
 * and the only elevation is the design bundle's single soft shadow.
 *
 * Theme + accent toggles live on `<html data-theme=… data-accent=…>` and are
 * controlled by the Tweaks popover in `<BreadcrumbBar />`. Defaults are set
 * here so the initial paint matches the design's default (`cream` + `sage`).
 */

const THEME_STORAGE_KEY = "jobops_theme";
const ACCENT_STORAGE_KEY = "jobops_accent";

function applyInitialTheme() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = localStorage.getItem(THEME_STORAGE_KEY) ?? "cream";
  const accent = localStorage.getItem(ACCENT_STORAGE_KEY) ?? "sage";
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-accent", accent);
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyInitialTheme();
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "232px 1fr",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--paper)",
      }}
    >
      <FloatingSidebar />
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--paper)",
        }}
      >
        <BreadcrumbBar />
        <div className="quiet-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
