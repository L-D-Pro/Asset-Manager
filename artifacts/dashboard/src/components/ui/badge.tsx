function Badge({ variant: _v, className: _c, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: string }) {
  return <span {...props} />;
}

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { variant?: string };

export { Badge, type BadgeProps };
