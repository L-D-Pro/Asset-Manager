export type ThemeMode = "light" | "dark";

export interface ExternalPaletteInput {
  bgPrimary: string;
  bgGlass: string;
  textMain: string;
  textSubtle?: string;
  brandPrimary: string;
  brandAccent?: string;
  borderSubtle?: string;
  borderStrong?: string;
}

export interface SemanticThemeTokens {
  bgPrimary: string;
  bgGlass: string;
  surfaceCard: string;
  surfaceElevated: string;
  borderSubtle: string;
  borderStrong: string;
  textMain: string;
  textSubtle: string;
  brandPrimary: string;
  brandAccent: string;
  shadowSoft: string;
  shadowFloat: string;
  ringFocus: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  mode: ThemeMode;
  palette: ExternalPaletteInput;
  tokens?: Partial<SemanticThemeTokens>;
}

export interface UiShellThemePayload {
  themeID: string;
  themes: ThemeDefinition[];
}
