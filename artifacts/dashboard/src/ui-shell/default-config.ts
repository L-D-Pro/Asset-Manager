import type { ThemeDefinition, UIConfig } from "@workspace/ui-core";

export const UI_SHELL_APP_KEY = "dashboard";

export const defaultUIConfig: UIConfig = {
 version: 1,
 appKey: UI_SHELL_APP_KEY,
 themeID: "higo-pastel-02",
 slots: {
 navbar: [
 {
 id: "nav-dashboard",
 componentKey: "nav-dashboard",
 order: 0,
 visibility: true,
 label: "Dashboard",
 },
 {
 id: "nav-wizard",
 componentKey: "nav-wizard",
 order: 1,
 visibility: true,
 label: "Wizard",
 },
 {
 id: "nav-trends",
 componentKey: "nav-trends",
 order: 2,
 visibility: true,
 label: "Trends",
 },
 {
 id: "nav-resources",
 componentKey: "nav-resources",
 order: 3,
 visibility: true,
 label: "Resources",
 },
 ],
 sidebar: [],
 dashboardGrid: [
 {
 id: "dashboard-hero",
 componentKey: "dashboard-hero",
 order: 0,
 visibility: true,
 label: "Hero",
 },
 {
 id: "dashboard-stats",
 componentKey: "dashboard-stats",
 order: 1,
 visibility: true,
 label: "Stats",
 },
 {
 id: "dashboard-actions",
 componentKey: "dashboard-actions",
 order: 2,
 visibility: true,
 label: "Quick Actions",
 },
 {
 id: "dashboard-activity",
 componentKey: "dashboard-activity",
 order: 3,
 visibility: true,
 label: "Recent Activity",
 },
 ],
 },
 updatedAt: new Date(0).toISOString(),
 updatedBy: null,
};

function normalizeHex(value: string): string {
 const hex = value.trim().toUpperCase();
 return hex.startsWith("#") ? hex : `#${hex}`;
}

function toRgb(hex: string): { r: number; g: number; b: number } {
 const clean = normalizeHex(hex).replace("#", "");
 return {
 r: Number.parseInt(clean.slice(0, 2), 16),
 g: Number.parseInt(clean.slice(2, 4), 16),
 b: Number.parseInt(clean.slice(4, 6), 16),
 };
}

function luminance(hex: string): number {
 const { r, g, b } = toRgb(hex);
 return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex: string): number {
 const { r, g, b } = toRgb(hex);
 const max = Math.max(r, g, b);
 const min = Math.min(r, g, b);
 return max - min;
}

function colorDistance(hexA: string, hexB: string): number {
 const a = toRgb(hexA);
 const b = toRgb(hexB);
 return Math.sqrt(
 (a.r - b.r) ** 2 +
 (a.g - b.g) ** 2 +
 (a.b - b.b) ** 2,
 );
}

function mix(hexA: string, hexB: string, ratio: number): string {
 const a = toRgb(hexA);
 const b = toRgb(hexB);
 const r = Math.round(a.r + (b.r - a.r) * ratio);
 const g = Math.round(a.g + (b.g - a.g) * ratio);
 const bCh = Math.round(a.b + (b.b - a.b) * ratio);
 return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bCh.toString(16).padStart(2, "0")}`.toUpperCase();
}

function buildThemeFromHexes(id: string, name: string, hexes: string[]): ThemeDefinition {
 const normalized = hexes.map(normalizeHex);
 const byLightness = [...normalized].sort((a, b) => luminance(a) - luminance(b));
 const bySaturation = [...normalized].sort((a, b) => saturation(b) - saturation(a));
 const darkest = byLightness[0];
 const secondDarkest = byLightness[1] ?? darkest;
 const lightest = byLightness[byLightness.length - 1];
 const secondLightest = byLightness[byLightness.length - 2] ?? lightest;
 const vivid = bySaturation[0];
 const distinctAccent =
 normalized
 .filter((color) => color !== vivid)
 .sort((a, b) => colorDistance(b, vivid) - colorDistance(a, vivid))[0] ?? vivid;

 return {
 id,
 name,
 mode: "light",
 palette: {
 bgPrimary: lightest,
 bgGlass: secondLightest,
 textMain: darkest,
 textSubtle: mix(darkest, lightest, 0.35),
 brandPrimary: vivid,
 brandAccent: distinctAccent,
 borderSubtle: mix(lightest, darkest, 0.14),
 borderStrong: mix(lightest, darkest, 0.24),
 },
 };
}

const HIGO_PASTEL: Array<{ id: string; name: string; hexes: string[] }> = [
 { id: "higo-pastel-01", name: "Pastel 01 Aqua Rose", hexes: ["#A3F8F8", "#A5E2E2", "#DFBEBF", "#E7A4A3", "#FF9090"] },
 { id: "higo-pastel-02", name: "Pastel 02 Tranquil Sky", hexes: ["#A7B1D7", "#B7C8E5", "#D2DDED", "#BCE1FE", "#A2D2FF"] },
 { id: "higo-pastel-03", name: "Pastel 03 Pink Haze", hexes: ["#FFAFCC", "#FFC7DD", "#FFE1ED", "#DADBFB", "#BDBEF5"] },
 { id: "higo-pastel-04", name: "Pastel 04 Floral Meadow", hexes: ["#FCC8DF", "#FFE1EE", "#F0FBEF", "#D4F7D1", "#BFEFBC"] },
 { id: "higo-pastel-05", name: "Pastel 05 Rustic Olive", hexes: ["#949F6E", "#CCD5AE", "#E9EDCA", "#FDFAE0", "#FAEDCD"] },
 { id: "higo-pastel-06", name: "Pastel 06 Candy Breeze", hexes: ["#FFB7D2", "#FECFE1", "#E0F0FF", "#C6E4FE", "#ABD6FE"] },
 { id: "higo-pastel-07", name: "Pastel 07 Soft Stone", hexes: ["#ECCAC6", "#EADACF", "#E5E5F2", "#C8C8DC", "#888991"] },
 { id: "higo-pastel-08", name: "Pastel 08 Organic Spring", hexes: ["#D0AFAB", "#ECCAC6", "#F7EAB3", "#C2E5CD", "#C9D8DE"] },
 { id: "higo-pastel-09", name: "Pastel 09 Muted Grove", hexes: ["#BACCB8", "#DFE8E0", "#D7D8EA", "#C3C5E1", "#A8AAC5"] },
 { id: "higo-pastel-10", name: "Pastel 10 Sunlit Cloud", hexes: ["#F8E2AA", "#FAEDCD", "#FDFAE0", "#CAE7FF", "#8FBAE1"] },
 { id: "higo-pastel-11", name: "Pastel 11 Dream Blend", hexes: ["#8491A8", "#C1B4CB", "#E9C3C7", "#FCD4F4", "#C8CFFF"] },
 { id: "higo-pastel-12", name: "Pastel 12 Peach Bloom", hexes: ["#F5E6D2", "#FCD5BA", "#F6A6B5", "#F2B4A6", "#D98B9A"] },
 { id: "higo-pastel-13", name: "Pastel 13 Sage Linen", hexes: ["#E8EDEA", "#E4F5DF", "#D2E3CA", "#BFD6B0", "#A4BA95"] },
 { id: "higo-pastel-14", name: "Pastel 14 Tropical Pop", hexes: ["#99FFDA", "#A1A2DF", "#F5D0E3", "#FACDAA", "#D2FAC3"] },
 { id: "higo-pastel-15", name: "Pastel 15 Royal Dawn", hexes: ["#FFFBEF", "#FFEFC7", "#E2BDFF", "#D9A3FF", "#BD88E2"] },
];

const HIGO_PINK: Array<{ id: string; name: string; hexes: string[] }> = [
 { id: "higo-pink-01", name: "Pink 01 Blush Petal", hexes: ["#FFE9EF", "#FFC9D7", "#FFBCCD", "#FF9CB5", "#FC809F"] },
 { id: "higo-pink-02", name: "Pink 02 Crimson Charm", hexes: ["#FDB3C2", "#F891A5", "#E56D85", "#BF3853", "#A41F39"] },
 { id: "higo-pink-03", name: "Pink 03 Sky Pop", hexes: ["#FFCCDE", "#FF8EB7", "#E04582", "#BADFFF", "#7FC3FF"] },
 { id: "higo-pink-04", name: "Pink 04 Mint Rose", hexes: ["#FBD1DB", "#ED9AAE", "#E5748F", "#99EDCC", "#47D69D"] },
 { id: "higo-pink-05", name: "Pink 05 Golden Blush", hexes: ["#FFEFF3", "#F68EA7", "#FA809D", "#D8738D", "#FFF4C3"] },
 { id: "higo-pink-06", name: "Pink 06 Lavender Dream", hexes: ["#FFD6E0", "#FFC0CF", "#FFA0B6", "#C1C1ED", "#B3B3E3"] },
 { id: "higo-pink-07", name: "Pink 07 Vintage Mauve", hexes: ["#EED2DE", "#DB9EB8", "#E28DB0", "#C3B6C9", "#AEA4B3"] },
 { id: "higo-pink-08", name: "Pink 08 Coral Spark", hexes: ["#FFA6B4", "#FF879A", "#FF7F92", "#FF647B", "#FA4E67"] },
 { id: "higo-pink-09", name: "Pink 09 Neon Peach", hexes: ["#F6F1F3", "#FF63A7", "#FF398F", "#FFBC7D", "#FFAE63"] },
 { id: "higo-pink-10", name: "Pink 10 Earthy Rose", hexes: ["#A7816D", "#AF8F7E", "#DFC1CB", "#C48197", "#B66681"] },
 { id: "higo-pink-11", name: "Pink 11 Electric Bloom", hexes: ["#FFC7E1", "#F261A5", "#E23485", "#334F9F", "#0F286E"] },
 { id: "higo-pink-12", name: "Pink 12 Deep Garden", hexes: ["#FFC7E1", "#F261A5", "#E23485", "#4E7665", "#1E372C"] },
 { id: "higo-pink-13", name: "Pink 13 Amber Petal", hexes: ["#FDECEF", "#F6C8D1", "#E99DAC", "#E0BB74", "#D4A142"] },
 { id: "higo-pink-14", name: "Pink 14 Velvet Orchid", hexes: ["#FFCEE1", "#F18CB5", "#D55D8D", "#802684", "#500552"] },
 { id: "higo-pink-15", name: "Pink 15 Sunset Pulse", hexes: ["#FFC8DE", "#EB5993", "#DA3A7A", "#FF7B6D", "#FB4B37"] },
 { id: "higo-pink-16", name: "Pink 16 Antique Rose", hexes: ["#EEC8CF", "#CE8A97", "#AE5969", "#634A45", "#412722"] },
 { id: "higo-pink-17", name: "Pink 17 Spring Sugar", hexes: ["#FFBDD3", "#FFCFDF", "#FEFDCA", "#D9F6A6", "#CDF589"] },
 { id: "higo-pink-18", name: "Pink 18 Fire Pop", hexes: ["#FA3778", "#FF6699", "#FFD1CC", "#FB4B37", "#BA0000"] },
 { id: "higo-pink-19", name: "Pink 19 Aqua Contrast", hexes: ["#FFCFE1", "#E77DA4", "#D55081", "#58B1C0", "#01889F"] },
 { id: "higo-pink-20", name: "Pink 20 Vivid Blush", hexes: ["#FFA6BE", "#FF87A7", "#FA7697", "#FF648B", "#FA4E79"] },
 { id: "higo-pink-21", name: "Pink 21 Drama Rose", hexes: ["#FFC8DB", "#EB4C81", "#D52E66", "#9B0000", "#10006C"] },
 { id: "higo-pink-22", name: "Pink 22 Electric Candy", hexes: ["#FFE4F8", "#FF84E0", "#FF00C0", "#6000A0", "#4000C0"] },
 { id: "higo-pink-23", name: "Pink 23 Citrus Rose", hexes: ["#FFDDE7", "#FF7FA3", "#FF5A89", "#F06838", "#D63900"] },
 { id: "higo-pink-24", name: "Pink 24 Night Bloom", hexes: ["#FAFAFA", "#FF7EA3", "#EF5984", "#F06838", "#0B004F"] },
 { id: "higo-pink-25", name: "Pink 25 Candy Mint", hexes: ["#FAFAFA", "#FFB6CB", "#FF83A6", "#82FFBA", "#82D1FF"] },
];

const HIGO_THEMES = [...HIGO_PASTEL, ...HIGO_PINK].map((theme) =>
 buildThemeFromHexes(theme.id, theme.name, theme.hexes),
);

export const defaultThemes: ThemeDefinition[] = HIGO_THEMES;
