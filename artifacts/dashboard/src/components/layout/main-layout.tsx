import { FloatingSidebar } from "@/components/navigation/floating-sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { CommandPalette } from "@/components/navigation/command-palette";
import { Link } from "react-router-dom";
import { UiThemeProvider } from "@workspace/ui-core";
import { useResolvedUiTheme } from "@/ui-shell/use-ui-shell-config";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const activeTheme = useResolvedUiTheme();

  return (
    <UiThemeProvider defaultTheme={activeTheme}>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Ambient color orbs for atmospheric depth */}
        <div className="orb-blue w-[500px] h-[500px] -top-40 -right-40" />
        <div className="orb-purple w-[600px] h-[600px] -bottom-60 -left-60" />
        <div className="orb-orange w-[400px] h-[400px] top-1/2 left-1/3 opacity-50" />

        <FloatingSidebar />
        <main className="md:ml-[92px] pb-16 md:pb-0 px-4 md:px-8 pt-4 md:pt-8 relative z-10">
          <div className="mx-auto max-w-5xl">{children}</div>
          <footer className="mx-auto max-w-5xl mt-12 mb-4 text-center text-xs text-muted-foreground space-y-1">
            <p>
              &copy; 2026 Cyrus Sepasi. All rights reserved. Portfolio Studio&trade; is a product of
              L&amp;D PRO.
            </p>
            <p className="space-x-3">
              <Link to="/terms-of-service" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <span>|</span>
              <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </p>
          </footer>
        </main>
        <BottomNav />
        <CommandPalette />
      </div>
    </UiThemeProvider>
  );
}
