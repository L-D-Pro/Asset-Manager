import { Sidebar } from "./sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center px-4 bg-card/50 backdrop-blur sticky top-0 z-10">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              {children}
            </div>
          </main>
          <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground space-y-1">
            <p>&copy; 2026 Cyrus Sepasi. All rights reserved. Portfolio Studio&trade; is a product of L&amp;D PRO.</p>
            <p className="space-x-3">
              <span className="hover:text-foreground transition-colors cursor-pointer">Terms of Service</span>
              <span className="text-border">|</span>
              <span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span>
            </p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
