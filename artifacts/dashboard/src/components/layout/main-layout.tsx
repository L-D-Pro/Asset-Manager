import { Outlet } from "react-router-dom";
import { FloatingSidebar } from "@/components/navigation";
import { BreadcrumbBar } from "./breadcrumb-bar";
import { CommandPalette } from "@/components/navigation";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";

function MainLayout() {
  return (
    <div className="app">
      <WelcomeModal />
      <FloatingSidebar />
      <div className="main">
        <BreadcrumbBar />
        <div className="scroll">
          <Outlet />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
export { MainLayout };
