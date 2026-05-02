import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ThemeDefinition, UIConfig } from "@workspace/ui-core";
import { defaultThemes, defaultUIConfig, UI_SHELL_APP_KEY } from "./default-config";

type UiShellConfigResponse = {
 themeID: string;
 themeDefinitions: ThemeDefinition[];
 uiConfig: UIConfig;
};

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

 return (await response.json()) as UiShellConfigResponse;
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
