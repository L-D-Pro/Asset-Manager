import type {
  ExternalPaletteInput,
  SemanticThemeTokens,
  ThemeDefinition,
} from "./theme-types";

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  return hex.toLowerCase();
}

function parseHexChannel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16);
}

function toRgb(hexInput: string): { r: number; g: number; b: number } {
  const hex = normalizeHex(hexInput);
  return {
    r: parseHexChannel(hex, 1),
    g: parseHexChannel(hex, 3),
    b: parseHexChannel(hex, 5),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const channel = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mix(hexA: string, hexB: string, ratio: number): string {
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  return toHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  });
}

function isDarkHex(hexInput: string): boolean {
  const { r, g, b } = toRgb(hexInput);
  const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return brightness < 128;
}

function contrastTextFor(hexInput: string): string {
  return isDarkHex(hexInput) ? "#f8fafc" : "#172033";
}

function pick(primary: string, fallback?: string): string {
  return fallback?.trim() ? normalizeHex(fallback) : normalizeHex(primary);
}

export function mapPaletteToSemanticTokens(
  palette: ExternalPaletteInput,
): SemanticThemeTokens {
  const brandPrimary = normalizeHex(palette.brandPrimary);
  const brandAccent = pick(brandPrimary, palette.brandAccent);
  const darkTheme = isDarkHex(palette.bgPrimary);

  if (darkTheme) {
    return {
      bgPrimary: mix("#090f1a", brandPrimary, 0.04),
      bgGlass: mix("#111827", brandAccent, 0.06),
      surfaceCard: mix("#172033", brandPrimary, 0.07),
      surfaceElevated: mix("#1f2937", brandAccent, 0.08),
      borderSubtle: mix("#334155", brandPrimary, 0.08),
      borderStrong: mix("#475569", brandAccent, 0.1),
      textMain: "#f8fafc",
      textSubtle: "#b7c3d6",
      brandPrimary,
      brandAccent,
      shadowSoft: "0 1px 1px rgb(0 0 0 / 0.36)",
      shadowFloat: "0 22px 56px rgb(0 0 0 / 0.46)",
      ringFocus: brandAccent,
    };
  }

  return {
    bgPrimary: mix("#f7f9fc", brandAccent, 0.025),
    bgGlass: mix("#eef3f8", brandPrimary, 0.035),
    surfaceCard: mix("#ffffff", brandAccent, 0.025),
    surfaceElevated: mix("#fbfdff", brandPrimary, 0.035),
    borderSubtle: pick(mix("#d9e2ee", brandPrimary, 0.08), palette.borderSubtle),
    borderStrong: pick(mix("#bdcad9", brandAccent, 0.12), palette.borderStrong),
    textMain: contrastTextFor("#f7f9fc"),
    textSubtle: pick("#607089", palette.textSubtle),
    brandPrimary,
    brandAccent,
    shadowSoft: "0 1px 1px rgb(15 23 42 / 0.07)",
    shadowFloat: "0 18px 48px rgb(15 23 42 / 0.14)",
    ringFocus: brandAccent,
  };
}

export function resolveThemeDefinition(theme: ThemeDefinition): SemanticThemeTokens {
  const mapped = mapPaletteToSemanticTokens(theme.palette);
  return { ...mapped, ...theme.tokens };
}
