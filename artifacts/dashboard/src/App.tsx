import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/main-layout";
import Dashboard from "@/pages/dashboard";
import JobsList from "@/pages/jobs";
import JobDetail from "@/pages/jobs/[id]";
import ClaimsPage from "@/pages/claims";
import ResumeVersionsPage from "@/pages/resume-versions";
import CoverLettersPage from "@/pages/cover-letters";
import ApplicationsPage from "@/pages/applications";
import AiConfigPage from "@/pages/ai-config";
import RoleProfilesPage from "@/pages/role-profiles";
import FeedbackPage from "@/pages/feedback";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<JobsList />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/claims" element={<ClaimsPage />} />
        <Route path="/resume-versions" element={<ResumeVersionsPage />} />
        <Route path="/cover-letters" element={<CoverLettersPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/ai-config" element={<AiConfigPage />} />
        <Route path="/role-profiles" element={<RoleProfilesPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MainLayout>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter basename={base}>
          <AppRoutes />
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
