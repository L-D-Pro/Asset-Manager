import type { UISlotItem } from "../orchestration/schema";

export function LayoutEditor({
  items,
  onRenameItem,
}: {
  items: UISlotItem[];
  onRenameItem: (itemId: string, label: string) => void;
}) {
  return (
    <div className="ui-layout-editor">
      {items.map((item) => (
        <label key={item.id} className="ui-layout-editor-row">
          <span>{item.id}</span>
          <input
            value={item.label}
            onChange={(event) => onRenameItem(item.id, event.currentTarget.value)}
          />
        </label>
      ))}
    </div>
  );
}
