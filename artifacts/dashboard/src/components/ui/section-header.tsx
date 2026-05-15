import { Link } from "react-router-dom";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

export function SectionHeader({ title, description, action, ...props }: SectionHeaderProps) {
  return (
    <div {...props}>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && (
        <Link to={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
