import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

export type UISlotItem = {
  id: string;
  order: number;
  componentKey?: string;
  label?: string;
  locked?: boolean;
  visibility?: boolean;
};

export type UIConfig = {
  version: number;
  appKey: string;
  themeID: string;
  slots: {
    navbar: UISlotItem[];
    sidebar: UISlotItem[];
    dashboardGrid: UISlotItem[];
  };
  updatedAt: string;
  updatedBy: string | null;
};

export type ThemeDefinition = {
  id: string;
  name: string;
  mode: string;
  palette: {
    bgPrimary: string;
    bgGlass: string;
    textMain: string;
    brandPrimary: string;
    brandAccent?: string;
  };
};

const UISlotItemSchema = z.object({
  id: z.string(),
  order: z.number(),
  componentKey: z.string().optional(),
  label: z.string().optional(),
  locked: z.boolean().optional(),
  visibility: z.boolean().optional(),
});

const UIConfigSchema = z.object({
  version: z.number(),
  appKey: z.string(),
  themeID: z.string(),
  slots: z.object({
    navbar: z.array(UISlotItemSchema),
    sidebar: z.array(UISlotItemSchema),
    dashboardGrid: z.array(UISlotItemSchema),
  }),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});

export const UI_SHELL_APP_KEY = "dashboard";

export const defaultUIConfig: UIConfig = {
  version: 1,
  appKey: UI_SHELL_APP_KEY,
  themeID: "higo-pastel-02",
  slots: {
    navbar: [],
    sidebar: [],
    dashboardGrid: [],
  },
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

export const defaultThemes: ThemeDefinition[] = [
  {
    id: "higo-pastel-02",
    name: "Tranquil Sky",
    mode: "light",
    palette: {
      bgPrimary: "#A7B1D7",
      bgGlass: "#B7C8E5",
      textMain: "#D2DDED",
      brandPrimary: "#BCE1FE",
    },
  },
];

type UiShellConfigResponse = {
 themeID: string;
 themeDefinitions: ThemeDefinition[];
 uiConfig: UIConfig;
};

function isNonEmptyString(value: unknown): value is string {
 return typeof value === "string" && value.trim().length > 0;
}

function isThemeDefinition(value: unknown): value is ThemeDefinition {
 if (!value || typeof value !== "object") return false;
 const candidate = value as Partial<ThemeDefinition>;
 if (!isNonEmptyString(candidate.id) || !isNonEmptyString(candidate.name)) return false;
 if (candidate.mode !== "light" && candidate.mode !== "dark") return false;
 const palette = candidate.palette as ThemeDefinition["palette"] | undefined;
 if (!palette || typeof palette !== "object") return false;
 return (
 isNonEmptyString(palette.bgPrimary) &&
 isNonEmptyString(palette.bgGlass) &&
 isNonEmptyString(palette.textMain) &&
 isNonEmptyString(palette.brandPrimary)
 );
}

function normalizeSlotItems(items: UIConfig["slots"]["navbar"]): UIConfig["slots"]["navbar"] {
 const seen = new Set<string>();
 const deduped = items.filter((item) => {
 if (seen.has(item.id)) return false;
 seen.add(item.id);
 return true;
 });
 return deduped.map((item, index) => ({ ...item, order: index }));
}

function normalizeUiConfigForRuntime(config: UIConfig): UIConfig {
 return {
 ...config,
 slots: {
 ...config.slots,
 navbar: normalizeSlotItems(config.slots.navbar),
 sidebar: normalizeSlotItems(config.slots.sidebar),
 dashboardGrid: normalizeSlotItems(config.slots.dashboardGrid),
 },
 };
}

const UI_SHELL_QUERY_KEY = ["ui-shell-config", UI_SHELL_APP_KEY] as const;

function mergeThemeDefinitions(serverThemes: ThemeDefinition[] | undefined): ThemeDefinition[] {
 const merged = new Map<string, ThemeDefinition>();
 const builtInIds = new Set(defaultThemes.map((theme) => theme.id));
 for (const theme of serverThemes ?? []) {
 if (!builtInIds.has(theme.id)) {
 merged.set(theme.id, theme);
 }
 }
 for (const theme of defaultThemes) {
 merged.set(theme.id, theme);
 }
 return Array.from(merged.values());
}

function sanitizeThemeDefinitions(raw: unknown): ThemeDefinition[] {
 if (!Array.isArray(raw)) return defaultThemes;
 const valid = raw.filter((theme): theme is ThemeDefinition => isThemeDefinition(theme));
 return valid.length > 0 ? valid : defaultThemes;
}

function sanitizeUiShellState(payload: unknown): UiShellConfigResponse {
 if (!payload || typeof payload !== "object") {
 return {
 themeID: defaultUIConfig.themeID,
 themeDefinitions: defaultThemes,
 uiConfig: defaultUIConfig,
 };
 }

 const candidate = payload as Partial<UiShellConfigResponse>;
 const parsedConfig = UIConfigSchema.safeParse(candidate.uiConfig);
 const safeConfig = parsedConfig.success
 ? normalizeUiConfigForRuntime(parsedConfig.data)
 : defaultUIConfig;
 const safeThemes = sanitizeThemeDefinitions(candidate.themeDefinitions);
 const safeThemeID = typeof candidate.themeID === "string" && candidate.themeID.length > 0
 ? candidate.themeID
 : safeConfig.themeID;
 const resolvedThemeID = safeThemes.some((theme) => theme.id === safeThemeID)
 ? safeThemeID
 : safeConfig.themeID;

 return {
 themeID: resolvedThemeID,
 themeDefinitions: safeThemes,
 uiConfig: safeConfig,
 };
}

async function fetchUiShellState(appKey: string): Promise<UiShellConfigResponse> {
 const response = await fetch(`/api/admin/ui-shell-configs/${appKey}`, {
 credentials: "include",
 });

 if (response.status === 404) {
 return {
 themeID: defaultUIConfig.themeID,
 themeDefinitions: defaultThemes,
 uiConfig: defaultUIConfig,
 };
 }

 if (!response.ok) {
 throw new Error("Failed to load UI shell config.");
 }

 return sanitizeUiShellState(await response.json());
}

async function putUiShellState(
 appKey: string,
 payload: Pick<UiShellConfigResponse, "themeID" | "themeDefinitions" | "uiConfig">,
): Promise<UiShellConfigResponse> {
 const response = await fetch(`/api/admin/ui-shell-configs/${appKey}`, {
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 credentials: "include",
 body: JSON.stringify(payload),
 });

 if (!response.ok) {
 throw new Error("Failed to save UI shell config.");
 }

 return (await response.json()) as UiShellConfigResponse;
}

async function postResetUiShellState(appKey: string): Promise<UiShellConfigResponse> {
 const response = await fetch(`/api/admin/ui-shell-configs/${appKey}/reset`, {
 method: "POST",
 credentials: "include",
 });

 if (!response.ok) {
 throw new Error("Failed to reset UI shell config.");
 }

 return (await response.json()) as UiShellConfigResponse;
}

export function useUiShellState() {
 const query = useQuery({
 queryKey: UI_SHELL_QUERY_KEY,
 queryFn: () => fetchUiShellState(UI_SHELL_APP_KEY),
 retry: false,
 });

 const mergedThemes = mergeThemeDefinitions(query.data?.themeDefinitions);
 const resolvedThemeID =
 query.data?.themeID && mergedThemes.some((theme) => theme.id === query.data.themeID)
 ? query.data.themeID
 : (mergedThemes[0]?.id ?? defaultUIConfig.themeID);

 return {
 ...query,
 config: query.data?.uiConfig ?? defaultUIConfig,
 themes: mergedThemes,
 themeID: resolvedThemeID,
 };
}

export function useResolvedUiConfig(): UIConfig {
 return useUiShellState().config;
}

export function useResolvedUiTheme(): ThemeDefinition {
 const { themes, themeID } = useUiShellState();
 return themes.find((theme) => theme.id === themeID) ?? themes[0] ?? defaultThemes[0];
}

export function useSaveUiShellState() {
 const queryClient = useQueryClient();
 return useMutation({
 mutationFn: ({
 appKey,
 data,
 }: {
 appKey: string;
 data: Pick<UiShellConfigResponse, "themeID" | "themeDefinitions" | "uiConfig">;
 }) => putUiShellState(appKey, data),
 onSuccess: () => {
 void queryClient.invalidateQueries({ queryKey: UI_SHELL_QUERY_KEY });
 },
 });
}

export function useResetUiShellState() {
 const queryClient = useQueryClient();
 return useMutation({
 mutationFn: ({ appKey }: { appKey: string }) => postResetUiShellState(appKey),
 onSuccess: () => {
 void queryClient.invalidateQueries({ queryKey: UI_SHELL_QUERY_KEY });
 },
 });
}
