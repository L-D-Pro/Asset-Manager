import type { ComponentType } from "react";

export type UiComponentRegistry = Record<
  string,
  ComponentType<Record<string, unknown>>
>;
