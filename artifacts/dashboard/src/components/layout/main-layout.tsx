import { Outlet } from "react-router-dom";
import { FloatingSidebar } from "@/components/navigation";
import { BreadcrumbBar } from "./breadcrumb-bar";
import { CommandPalette } from "@/components/navigation";
import { PageTransition } from "@/components/motion/page-transition";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";

function MainLayout() {
  return (
    <div>
      <WelcomeModal />
      <FloatingSidebar />
      <div>
        <BreadcrumbBar />
        <PageTransition>
          <main>
            <Outlet />
          </main>
        </PageTransition>
      </div>
      <CommandPalette />
    </div>
  );
}
export { MainLayout };
