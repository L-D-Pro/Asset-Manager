import * as React from "react";

function Separator({
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.HTMLAttributes<HTMLHRElement> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}) {
  return (
    <hr
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      {...props}
    />
  );
}

export { Separator };
