import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeMode = "dark" | "light";
type AccentColor = "lime" | "pink" | "cyan" | "violet";

interface ThemeContextValue {
  theme: ThemeMode;
  accent: AccentColor;
  setTheme: (t: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "jobops-theme";

function load(): { theme: ThemeMode; accent: AccentColor } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme === "light" ? "light" : "dark",
        accent: (["lime", "pink", "cyan", "violet"].includes(parsed.accent) ? parsed.accent : "lime") as AccentColor,
      };
    }
  } catch {}
  return { theme: "dark", accent: "lime" };
}

function persist(theme: ThemeMode, accent: AccentColor) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, accent })); } catch {}
}

function applyToHtml(theme: ThemeMode, accent: AccentColor) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-accent", accent);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ theme: ThemeMode; accent: AccentColor }>(load);

  useEffect(() => {
    applyToHtml(state.theme, state.accent);
    persist(state.theme, state.accent);
  }, [state.theme, state.accent]);

  // Apply immediately on mount (before paint) to avoid flash
  useEffect(() => {
    applyToHtml(state.theme, state.accent);
  }, []);

  const setTheme = (theme: ThemeMode) => setState(s => ({ ...s, theme }));
  const setAccent = (accent: AccentColor) => setState(s => ({ ...s, accent }));
  const toggleTheme = () => setState(s => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));

  return (
    <ThemeContext.Provider value={{ ...state, setTheme, setAccent, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
