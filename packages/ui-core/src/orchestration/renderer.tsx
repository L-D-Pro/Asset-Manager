import type { ReactNode } from "react";
import type { UiComponentRegistry } from "./registry";
import type { UIConfig, UISlotItem, UISlotKey } from "./schema";

function sortVisible(items: UISlotItem[]): UISlotItem[] {
  return items
    .filter((item) => item.visibility)
    .sort((a, b) => a.order - b.order);
}

export function LayoutRenderer({
  config,
  slot,
  registry,
  fallback,
}: {
  config: UIConfig;
  slot: UISlotKey;
  registry: UiComponentRegistry;
  fallback?: (componentKey: string) => ReactNode;
}) {
  const items = sortVisible(config.slots[slot]);

  return (
    <div className="ui-slot-layout" data-slot={slot}>
      {items.map((item) => {
        const Component = registry[item.componentKey];
        if (!Component) {
          return (
            <div key={item.id} data-slot-item={item.id}>
              {fallback?.(item.componentKey) ?? null}
            </div>
          );
        }
        return (
          <div key={item.id} data-slot-item={item.id}>
            <Component {...(item.props ?? {})} />
          </div>
        );
      })}
    </div>
  );
}
