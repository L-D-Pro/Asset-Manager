import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ThemeDefinition } from "./theme-types";
import { UiThemeProvider, useUiTheme } from "./theme-provider";

type AdminThemeContextValue = {
  draftTheme: ThemeDefinition;
  setDraftTheme: (theme: ThemeDefinition) => void;
  commitTheme: () => void;
  resetDraft: () => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function AdminThemeInner({
  initialTheme,
  children,
}: PropsWithChildren<{ initialTheme: ThemeDefinition }>) {
  const { activeTheme, setTheme } = useUiTheme();
  const [draftTheme, setDraftTheme] = useState<ThemeDefinition>(activeTheme);

  const value = useMemo<AdminThemeContextValue>(
    () => ({
      draftTheme,
      setDraftTheme,
      commitTheme: () => setTheme(draftTheme),
      resetDraft: () => setDraftTheme(initialTheme),
    }),
    [draftTheme, initialTheme, setTheme],
  );

  return (
    <AdminThemeContext.Provider value={value}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function AdminThemeProvider({
  initialTheme,
  children,
}: PropsWithChildren<{ initialTheme: ThemeDefinition }>) {
  return (
    <UiThemeProvider defaultTheme={initialTheme}>
      <AdminThemeInner initialTheme={initialTheme}>{children}</AdminThemeInner>
    </UiThemeProvider>
  );
}

export function useAdminTheme(): AdminThemeContextValue {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error("useAdminTheme must be used inside AdminThemeProvider");
  }
  return context;
}
