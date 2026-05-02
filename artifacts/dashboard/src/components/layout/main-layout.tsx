import { FloatingSidebar } from "@/components/navigation/floating-sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { CommandPalette } from "@/components/navigation/command-palette";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient color orbs — atmospheric depth */}
      <div className="orb-blue w-[500px] h-[500px] -top-40 -right-40" />
      <div className="orb-purple w-[600px] h-[600px] -bottom-60 -left-60" />
      <div className="orb-orange w-[400px] h-[400px] top-1/2 left-1/3 opacity-50" />

      <FloatingSidebar />
      <main className="md:ml-[92px] pb-16 md:pb-0 px-4 md:px-8 pt-4 md:pt-8 relative z-10">
        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </main>
      <BottomNav />
      <CommandPalette />
    </div>
  );
}