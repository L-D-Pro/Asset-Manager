import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDestructive = variant === "destructive";
        return (
          <Toast
            key={id}
            variant={variant}
            {...props}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "10px 14px",
              background: isDestructive ? "var(--danger-bg, #fff0f0)" : "var(--card)",
              border: `1px solid ${isDestructive ? "var(--danger, #d73a49)" : "var(--line)"}`,
              borderRadius: "var(--r-lg, 8px)",
              boxShadow: "var(--shadow-pop)",
              fontSize: 13,
              minWidth: 220,
              maxWidth: 340,
              cursor: "default",
            }}
          >
            <div style={{ flex: 1 }}>
              {title && (
                <ToastTitle style={{ fontWeight: 600, fontSize: 13, color: isDestructive ? "var(--danger, #d73a49)" : "var(--ink)" }}>
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose
              style={{
                position: "absolute", top: 6, right: 8,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 16, color: "var(--ink-4)", lineHeight: 1,
              }}
            >
              ×
            </ToastClose>
          </Toast>
        );
      })}
      <ToastViewport
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          listStyle: "none",
          padding: 0,
          margin: 0,
          outline: "none",
          width: 340,
        }}
      />
    </ToastProvider>
  );
}
