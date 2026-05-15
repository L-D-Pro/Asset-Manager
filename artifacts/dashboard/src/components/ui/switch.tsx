import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

function Switch({ ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root {...props}>
      <SwitchPrimitives.Thumb />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
