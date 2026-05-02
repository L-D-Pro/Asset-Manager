import type { HTMLAttributes } from "react";

export function DragHandle(props: HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="ui-drag-handle"
      {...props}
    >
      <span aria-hidden="true">::</span>
    </button>
  );
}
