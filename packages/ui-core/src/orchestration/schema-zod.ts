import { z } from "zod";

export const UISlotItemSchema = z.object({
  id: z.string().min(1),
  componentKey: z.string().min(1),
  order: z.number().int().nonnegative(),
  visibility: z.boolean(),
  label: z.string().min(1),
  locked: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const UIConfigSchema = z.object({
  version: z.literal(1),
  appKey: z.string().min(1),
  themeID: z.string().min(1),
  slots: z.object({
    navbar: z.array(UISlotItemSchema),
    sidebar: z.array(UISlotItemSchema),
    dashboardGrid: z.array(UISlotItemSchema),
  }),
  updatedAt: z.string().min(1),
  updatedBy: z.number().nullable(),
});
