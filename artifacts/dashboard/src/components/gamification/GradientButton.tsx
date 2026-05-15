interface GradientButtonProps {
  onClick?: () => void;
  size?: string;
  children: React.ReactNode;
}

export function GradientButton({ onClick, children }: GradientButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
