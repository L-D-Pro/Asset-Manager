import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/main-layout";
import { AuthProvider, useAuth } from "@/context/auth";
import LoginPage from "@/pages/login";
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
import GuidePage from "@/pages/guide";
import AccountPage from "@/pages/account";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("401")) return false;
        return failureCount < 2;
      },
    },
  },
});

/**
 * Wraps all protected routes. Shows a spinner while auth loads,
 * redirects to /login if unauthenticated, renders the app if authenticated.
 */
function ProtectedRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

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
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MainLayout>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user && user !== undefined ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter basename={base}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
