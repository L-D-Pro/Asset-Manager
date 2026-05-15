import * as React from "react";
const { forwardRef } = React;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  size?: string;
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant: _v, size: _s, asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) return children;
    return <button ref={ref} {...props}>{children}</button>;
  }
);
Button.displayName = "Button";

export { Button, type ButtonProps };
