import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/main-layout";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, hasHttpStatus } from "@/lib/api-errors";
import { AuthProvider, useAuth } from "@/context/auth";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import JobsList from "@/pages/jobs";
import JobDetail from "@/pages/jobs/[id]";
import ClaimsPage from "@/pages/claims";
import BaseResumePage from "@/pages/base-resume";
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
  queryCache: new QueryCache({
    onError: (error) => {
      if (hasHttpStatus(error, 401) || hasHttpStatus(error, 404)) {
        return;
      }

      toast({
        title: "Failed to load data",
        description: getErrorMessage(error, "Please refresh and try again."),
        variant: "destructive",
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (typeof mutation.options.onError === "function" || hasHttpStatus(error, 401)) {
        return;
      }

      toast({
        title: "Request failed",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (hasHttpStatus(error, 401)) return false;
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
        <Route path="/base-resume" element={<BaseResumePage />} />
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
