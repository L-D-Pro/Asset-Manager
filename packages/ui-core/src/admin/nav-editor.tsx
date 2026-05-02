import type { UISlotItem } from "../orchestration/schema";

export function NavEditor({
  items,
  onRename,
}: {
  items: UISlotItem[];
  onRename: (id: string, label: string) => void;
}) {
  return (
    <div className="ui-nav-editor">
      {items.map((item) => (
        <label key={item.id} className="ui-nav-editor-row">
          <span>{item.id}</span>
          <input
            value={item.label}
            onChange={(event) => onRename(item.id, event.currentTarget.value)}
          />
        </label>
      ))}
    </div>
  );
}
