import { Sidebar } from "./sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import { FeedbackWidget } from "@/components/feedback-widget";
import { ContextualHint } from "@/components/onboarding/contextual-hint";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/60 flex items-center px-4 bg-card/82 backdrop-blur-xl sticky top-0 z-10">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.34))] p-6">
            <div className="mx-auto max-w-6xl space-y-6">
              <ContextualHint />
              {children}
            </div>
          </main>
          <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground space-y-1">
            <p>&copy; 2026 L&D PRO. All rights reserved. Job Ops is a product of L&amp;D PRO.</p>
            <p className="space-x-3">
              <Link to="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <span className="text-border">|</span>
              <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            </p>
          </footer>
        </div>
      </div>
      <FeedbackWidget />
    </SidebarProvider>
  );
}
