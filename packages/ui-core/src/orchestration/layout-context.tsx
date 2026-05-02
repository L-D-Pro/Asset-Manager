import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";
import type { UIConfig } from "./schema";

type LayoutContextValue = {
  config: UIConfig;
  setConfig: (config: UIConfig) => void;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({
  initialConfig,
  children,
}: PropsWithChildren<{ initialConfig: UIConfig }>) {
  const [config, setConfig] = useState(initialConfig);
  const value = useMemo(() => ({ config, setConfig }), [config]);

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayoutConfig(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayoutConfig must be used inside LayoutProvider");
  }
  return context;
}
