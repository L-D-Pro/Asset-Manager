import type { UISlotItem } from "../orchestration/schema";

export function NavShell({ items }: { items: UISlotItem[] }) {
  const sorted = items
    .filter((item) => item.visibility)
    .sort((a, b) => a.order - b.order);

  return (
    <nav className="ui-nav-shell">
      {sorted.map((item) => (
          <a key={item.id} href={String(item.props?.href ?? "#")}>
            {item.label}
          </a>
        ))}
    </nav>
  );
}
