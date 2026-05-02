import { FloatingSidebar } from "@/components/navigation/floating-sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { CommandPalette } from "@/components/navigation/command-palette";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <FloatingSidebar />
      <main className="md:ml-[88px] pb-16 md:pb-0 px-4 md:px-8 pt-4 md:pt-8">
        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </main>
      <BottomNav />
      <CommandPalette />
    </div>
  );
}
