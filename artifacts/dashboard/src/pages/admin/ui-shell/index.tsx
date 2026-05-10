import { Component, type ErrorInfo, useEffect, useState } from "react";
import {
 type ThemeDefinition,
 type UIConfig,
 type UISlotItem,
 SortableList,
 SortableZoneItem,
} from "@workspace/ui-core";
import { ArrowUpDown, Eye, EyeOff, GripVertical, Loader2, RotateCcw, Save } from "lucide-react";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
 useResetUiShellState,
 useSaveUiShellState,
 useUiShellState,
} from "@/ui-shell/use-ui-shell-config";
import { defaultThemes, defaultUIConfig, UI_SHELL_APP_KEY } from "@/ui-shell/default-config";

function sortByOrder(items: UISlotItem[]): UISlotItem[] {
 return [...items].sort((a, b) => a.order - b.order);
}

function applyReorder(items: UISlotItem[], nextIds: string[]): UISlotItem[] {
 const byId = new Map(items.map((item) => [item.id, item]));
 return nextIds
 .map((id, index) => {
 const item = byId.get(id);
 if (!item) return null;
 return { ...item, order: index };
 })
 .filter((item): item is UISlotItem => Boolean(item));
}

function updateSlot(
 config: UIConfig,
 slot: keyof UIConfig["slots"],
 updater: (items: UISlotItem[]) => UISlotItem[],
): UIConfig {
 return {
 ...config,
 slots: {
 ...config.slots,
 [slot]: updater(config.slots[slot]),
 },
 };
}

function SlotEditor({
 title,
 description,
 items,
 onReorder,
 onRename,
 onVisibility,
}: {
 title: string;
 description: string;
 items: UISlotItem[];
 onReorder: (nextIds: string[]) => void;
 onRename: (id: string, label: string) => void;
 onVisibility: (id: string, visible: boolean) => void;
}) {
 const orderedItems = sortByOrder(items);
 const ids = orderedItems.map((item) => item.id);

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-base">
 <ArrowUpDown className="h-4 w-4" />
 {title}
 </CardTitle>
 <CardDescription>{description}</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <SortableList ids={ids} onReorder={onReorder}>
 <div className="space-y-3">
 {orderedItems.map((item) => (
 <SortableZoneItem key={item.id} id={item.id}>
 <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
 <div className="text-muted-foreground">
 {item.locked ? <span className="inline-flex h-5 w-5" /> : <GripVertical className="h-5 w-5" />}
 </div>
 <div className="min-w-0 flex-1 space-y-2">
 <p className="text-xs text-muted-foreground">{item.componentKey}</p>
 <Input
 value={item.label}
 onChange={(event) => onRename(item.id, event.currentTarget.value)}
 disabled={item.locked}
 />
 </div>
 <div className="flex items-center gap-2">
 <Switch
 checked={item.visibility}
 onCheckedChange={(checked) => onVisibility(item.id, checked)}
 disabled={item.locked}
 />
 {item.visibility ? (
 <Eye className="h-4 w-4 text-muted-foreground" />
 ) : (
 <EyeOff className="h-4 w-4 text-muted-foreground" />
 )}
 </div>
 </div>
 </SortableZoneItem>
 ))}
 </div>
 </SortableList>
 </CardContent>
 </Card>
 );
}

class UiShellErrorBoundary extends Component<
 { children: React.ReactNode },
 { error: Error | null }
> {
 constructor(props: { children: React.ReactNode }) {
 super(props);
 this.state = { error: null };
 }

 static getDerivedStateFromError(error: Error) {
 return { error };
 }

 componentDidCatch(error: Error, info: ErrorInfo) {
 console.error("UI Shell page crashed", error, info);
 }

 render() {
 if (this.state.error) {
 return (
 <Card>
 <CardHeader>
 <CardTitle>UI Shell Runtime Error</CardTitle>
 <CardDescription>{this.state.error.message}</CardDescription>
 </CardHeader>
 </Card>
 );
 }
 return this.props.children;
 }
}

function AdminUiShellPageContent() {
 const { user } = useAuth();
 const { config, themes, isLoading, refetch } = useUiShellState();
 const saveMutation = useSaveUiShellState();
 const resetMutation = useResetUiShellState();
 const [draftConfig, setDraftConfig] = useState<UIConfig | null>(null);
 const [draftThemes, setDraftThemes] = useState<ThemeDefinition[]>([]);

 const effectiveConfig = draftConfig ?? config;
 const effectiveThemes = draftThemes.length > 0 ? draftThemes : themes;
 const selectedTheme =
 effectiveThemes.find((theme) => theme.id === effectiveConfig.themeID) ?? effectiveThemes[0] ?? null;

 useEffect(() => {
 if (!draftConfig) {
 setDraftConfig(config);
 setDraftThemes(themes);
 }
 }, [config, draftConfig, themes]);

 if (user?.role !== "admin") {
 return (
 <Card>
 <CardHeader>
 <CardTitle>Access Denied</CardTitle>
 </CardHeader>
 </Card>
 );
 }

 const setSlot = (slot: keyof UIConfig["slots"], updater: (items: UISlotItem[]) => UISlotItem[]) => {
 setDraftConfig((current) => (current ? updateSlot(current, slot, updater) : current));
 };

 const setLabel = (slot: keyof UIConfig["slots"], id: string, label: string) => {
 setSlot(slot, (items) => items.map((item) => (item.id === id ? { ...item, label } : item)));
 };

 const setVisibility = (slot: keyof UIConfig["slots"], id: string, visibility: boolean) => {
 setSlot(slot, (items) => items.map((item) => (item.id === id ? { ...item, visibility } : item)));
 };

 const save = async () => {
 if (!draftConfig) return;
 try {
 await saveMutation.mutateAsync({
 appKey: UI_SHELL_APP_KEY,
 data: {
 themeID: draftConfig.themeID,
 themeDefinitions: effectiveThemes,
 uiConfig: draftConfig,
 },
 });
 toast({ title: "Saved", description: "UI shell configuration persisted." });
 await refetch();
 } catch (error) {
 const description = error instanceof Error ? error.message : "Could not save UI shell config.";
 toast({ title: "Save failed", description, variant: "destructive" });
 }
 };

 const reset = async () => {
 try {
 await resetMutation.mutateAsync({ appKey: UI_SHELL_APP_KEY });
 await saveMutation.mutateAsync({
 appKey: UI_SHELL_APP_KEY,
 data: {
 themeID: defaultUIConfig.themeID,
 themeDefinitions: defaultThemes,
 uiConfig: defaultUIConfig,
 },
 });
 setDraftConfig(defaultUIConfig);
 setDraftThemes(defaultThemes);
 toast({ title: "Reset complete", description: "Restored default slot configuration and theme set." });
 await refetch();
 } catch (error) {
 const description = error instanceof Error ? error.message : "Could not reset UI shell config.";
 toast({ title: "Reset failed", description, variant: "destructive" });
 }
 };

 return (
 <div className="space-y-6">
 <div className="flex flex-wrap items-end justify-between gap-3">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight">UI Shell Orchestration</h1>
 <p className="text-sm text-muted-foreground">
 Slot-scoped orchestration for navbar cards and dashboard widgets.
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="outline" onClick={reset} disabled={resetMutation.isPending || saveMutation.isPending}>
 {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
 Reset
 </Button>
 <Button onClick={save} disabled={saveMutation.isPending || !draftConfig}>
 {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
 Save
 </Button>
 </div>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>Semantic Theme</CardTitle>
 <CardDescription>
 Choose the active semantic palette. Component spacing, radii, and shadows remain fixed.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
             <div className="max-w-sm space-y-2">
             <Label htmlFor="theme-id">Theme</Label>
             <select
             id="theme-id"
             value={effectiveConfig.themeID}
             onChange={(event) =>
             setDraftConfig((current) =>
             current ? { ...current, themeID: event.currentTarget.value } : current
             )
             }
             className="flex h-12 w-full rounded-[16px] border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-base font-sans text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary))]"
             >
             {effectiveThemes.map((theme) => (
             <option key={theme.id} value={theme.id}>
             {theme.name}
             </option>
             ))}
             </select>
             </div>
 {selectedTheme ? (
 <div className="rounded-lg border border-border/70 bg-card/70 p-3">
 <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
 Theme preview
 </p>
 <div className="flex flex-wrap items-center gap-2">
 {[
 { label: "Primary", color: selectedTheme.palette.brandPrimary },
 { label: "Accent", color: selectedTheme.palette.brandAccent ?? selectedTheme.palette.brandPrimary },
 { label: "Surface", color: selectedTheme.palette.bgPrimary },
 { label: "Glass", color: selectedTheme.palette.bgGlass },
 { label: "Text", color: selectedTheme.palette.textMain },
 ].map((chip) => (
 <span
 key={`${selectedTheme.id}-${chip.label}`}
 className="inline-flex items-center gap-2 rounded-full border border-border/70 px-2 py-1 text-xs text-foreground"
 >
 <span className="h-2.5 w-2.5 rounded-full border border-border/70" style={{ backgroundColor: chip.color }} />
 {chip.label}
 </span>
 ))}
 </div>
 </div>
 ) : null}
 </CardContent>
 </Card>

 {isLoading || !draftConfig ? (
 <Card>
 <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 Loading UI shell configuration...
 </CardContent>
 </Card>
 ) : (
 <div className="grid gap-6 lg:grid-cols-2">
 <SlotEditor
 title="Navbar Slot"
 description="Reorder and rename featured cards shown at top of the left sidebar."
 items={effectiveConfig.slots.navbar}
 onReorder={(ids) => setSlot("navbar", (items) => applyReorder(items, ids))}
 onRename={(id, label) => setLabel("navbar", id, label)}
 onVisibility={(id, visibility) => setVisibility("navbar", id, visibility)}
 />
 <SlotEditor
 title="Dashboard Grid Slot"
 description="Control order and labels for dashboard sections. Layout frame stays fixed."
 items={effectiveConfig.slots.dashboardGrid}
 onReorder={(ids) => setSlot("dashboardGrid", (items) => applyReorder(items, ids))}
 onRename={(id, label) => setLabel("dashboardGrid", id, label)}
 onVisibility={(id, visibility) => setVisibility("dashboardGrid", id, visibility)}
 />
 </div>
 )}
 </div>
 );
}

export default function AdminUiShellPage() {
 return (
 <UiShellErrorBoundary>
 <AdminUiShellPageContent />
 </UiShellErrorBoundary>
 );
}
