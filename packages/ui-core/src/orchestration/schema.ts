export type UISlotKey = "navbar" | "sidebar" | "dashboardGrid";

export interface UISlotItem {
  id: string;
  componentKey: string;
  order: number;
  visibility: boolean;
  label: string;
  locked?: boolean;
  props?: Record<string, unknown>;
}

export interface UIConfig {
  version: 1;
  appKey: string;
  themeID: string;
  slots: {
    navbar: UISlotItem[];
    sidebar: UISlotItem[];
    dashboardGrid: UISlotItem[];
  };
  updatedAt: string;
  updatedBy: number | null;
}
