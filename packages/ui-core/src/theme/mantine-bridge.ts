import { createTheme, type MantineThemeOverride } from "@mantine/core";
import type { ThemeDefinition } from "./theme-types";
import { resolveThemeDefinition } from "./theme-mapper";

/* ------------------------------------------------------------------ */
/*  HSL-based 10-shade palette generator                              */
/*  Mantine expects [lightest … darkest] with primaryShade at index 6 */
/* ------------------------------------------------------------------ */

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let rr: number, gg: number, bb: number;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];

  const toChannel = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toChannel(rr)}${toChannel(gg)}${toChannel(bb)}`;
}

/**
 * Generates a Mantine-compatible tuple of 10 shades from a single hex color.
 * Index 0 = lightest, index 9 = darkest.
 * The input color is placed at index 6 (Mantine's default primaryShade).
 */
function generateMantineColors(
  hex: string,
): [string, string, string, string, string, string, string, string, string, string] {
  const { h, s } = hexToHsl(hex);

  // Lightness steps: lightest at [0], darkest at [9], input color ≈ [6]
  const lightnesses = [97, 93, 85, 76, 66, 56, 46, 38, 30, 22];

  return lightnesses.map((l) => hslToHex(h, Math.min(s, 100), l)) as [
    string, string, string, string, string,
    string, string, string, string, string,
  ];
}

export function mapThemeToMantine(theme: ThemeDefinition): MantineThemeOverride {
  const resolved = resolveThemeDefinition(theme);

  return createTheme({
    primaryColor: "brand",
    primaryShade: 6,
    colors: {
      brand: generateMantineColors(resolved.brandPrimary),
      accent: generateMantineColors(resolved.brandAccent),
    },
    fontFamily: "var(--app-font-sans)",
    headings: {
      fontFamily: "var(--app-font-sans)",
    },
    radius: {
      xs: "0.25rem",
      sm: "calc(var(--radius) - 4px)",
      md: "calc(var(--radius) - 2px)",
      lg: "var(--radius)",
      xl: "calc(var(--radius) + 4px)",
    },
    components: {
      Button: {
        defaultProps: {
          radius: "md",
        },
      },
      Card: {
        defaultProps: {
          radius: "lg",
          withBorder: true,
        },
      },
      Modal: {
        defaultProps: {
          radius: "lg",
        },
      },
      TextInput: {
        defaultProps: {
          radius: "md",
        },
      },
      Select: {
        defaultProps: {
          radius: "md",
        },
      },
      Badge: {
        defaultProps: {
          radius: "md",
        },
      },
    },
  });
}
