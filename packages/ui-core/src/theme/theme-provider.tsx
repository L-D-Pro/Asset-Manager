import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { resolveThemeDefinition } from "./theme-mapper";
import type { ThemeDefinition } from "./theme-types";
import { MantineProvider } from "@mantine/core";
import { mapThemeToMantine } from "./mantine-bridge";

type UiThemeContextValue = {
  activeTheme: ThemeDefinition;
  setTheme: (theme: ThemeDefinition) => void;
};

const UiThemeContext = createContext<UiThemeContextValue | null>(null);

const TOKEN_MAP: Record<string, string> = {
  "--bg-primary": "bgPrimary",
  "--bg-glass": "bgGlass",
  "--surface-card": "surfaceCard",
  "--surface-elevated": "surfaceElevated",
  "--border-subtle": "borderSubtle",
  "--border-strong": "borderStrong",
  "--text-main": "textMain",
  "--text-subtle": "textSubtle",
  "--brand-primary": "brandPrimary",
  "--brand-accent": "brandAccent",
  "--shadow-soft": "shadowSoft",
  "--shadow-float": "shadowFloat",
  "--ring-focus": "ringFocus",
};

function hexToHslChannels(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function isLightHex(hex: string): boolean {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return brightness > 172;
}

function applyThemeToElement(element: HTMLElement, theme: ThemeDefinition): void {
  const resolved = resolveThemeDefinition(theme);
  const primaryForeground = isLightHex(resolved.brandPrimary) ? "222 47% 11%" : "210 40% 98%";
  const accentForeground = isLightHex(resolved.brandAccent) ? "222 47% 11%" : "210 40% 98%";
  for (const [cssVar, tokenKey] of Object.entries(TOKEN_MAP)) {
    element.style.setProperty(cssVar, resolved[tokenKey as keyof typeof resolved]);
  }

  // Bridge semantic tokens to shadcn-compatible hsl(var(--token)) aliases.
  element.style.setProperty("--background", hexToHslChannels(resolved.bgPrimary));
  element.style.setProperty("--foreground", hexToHslChannels(resolved.textMain));
  element.style.setProperty("--card", hexToHslChannels(resolved.surfaceCard));
  element.style.setProperty("--card-foreground", hexToHslChannels(resolved.textMain));
  element.style.setProperty("--popover", hexToHslChannels(resolved.surfaceElevated));
  element.style.setProperty("--popover-foreground", hexToHslChannels(resolved.textMain));
  element.style.setProperty("--primary", hexToHslChannels(resolved.brandPrimary));
  element.style.setProperty("--primary-foreground", primaryForeground);
  element.style.setProperty("--secondary", hexToHslChannels(resolved.bgGlass));
  element.style.setProperty("--secondary-foreground", hexToHslChannels(resolved.textMain));
  element.style.setProperty("--muted", hexToHslChannels(resolved.bgGlass));
  element.style.setProperty("--muted-foreground", hexToHslChannels(resolved.textSubtle));
  element.style.setProperty("--accent", hexToHslChannels(resolved.brandAccent));
  element.style.setProperty("--accent-foreground", accentForeground);
  element.style.setProperty("--destructive", "0 84% 60%");
  element.style.setProperty("--destructive-foreground", "210 40% 98%");
  element.style.setProperty("--border", hexToHslChannels(resolved.borderSubtle));
  element.style.setProperty("--input", hexToHslChannels(resolved.borderSubtle));
  element.style.setProperty("--ring", hexToHslChannels(resolved.ringFocus));
  element.style.setProperty("--sidebar", hexToHslChannels(resolved.surfaceElevated));
  element.style.setProperty("--sidebar-foreground", hexToHslChannels(resolved.textMain));
  element.style.setProperty("--sidebar-border", hexToHslChannels(resolved.borderSubtle));
  element.style.setProperty("--sidebar-primary", hexToHslChannels(resolved.brandPrimary));
  element.style.setProperty("--sidebar-primary-foreground", primaryForeground);
  element.style.setProperty("--sidebar-accent", hexToHslChannels(resolved.bgGlass));
  element.style.setProperty("--sidebar-accent-foreground", hexToHslChannels(resolved.textMain));
  element.style.setProperty("--sidebar-ring", hexToHslChannels(resolved.ringFocus));
}

export function UiThemeProvider({
  children,
  defaultTheme,
}: PropsWithChildren<{ defaultTheme: ThemeDefinition }>) {
  const [activeTheme, setActiveTheme] = useState(defaultTheme);

  useEffect(() => {
    setActiveTheme(defaultTheme);
  }, [defaultTheme]);

  useEffect(() => {
    applyThemeToElement(document.documentElement, activeTheme);
    document.documentElement.dataset.uiTheme = activeTheme.id;
    document.documentElement.classList.toggle("dark", activeTheme.mode === "dark");
  }, [activeTheme]);

  const value = useMemo(
    () => ({ activeTheme, setTheme: setActiveTheme }),
    [activeTheme],
  );

  return (
    <UiThemeContext.Provider value={value}>
      <MantineProvider theme={mapThemeToMantine(activeTheme)} forceColorScheme={activeTheme.mode}>
        {children}
      </MantineProvider>
    </UiThemeContext.Provider>
  );
}

export function useUiTheme(): UiThemeContextValue {
  const context = useContext(UiThemeContext);
  if (!context) {
    throw new Error("useUiTheme must be used inside UiThemeProvider");
  }
  return context;
}
