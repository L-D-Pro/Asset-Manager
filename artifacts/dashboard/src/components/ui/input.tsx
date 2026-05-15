import * as React from "react";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ ...props }, ref) => <input ref={ref} {...props} />
);
Input.displayName = "Input";

export { Input };
