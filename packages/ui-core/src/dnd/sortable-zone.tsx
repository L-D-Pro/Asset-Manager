import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PropsWithChildren } from "react";

export function SortableZoneItem({
  id,
  children,
}: PropsWithChildren<{ id: string }>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-sortable-item={id}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
