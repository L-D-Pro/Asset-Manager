import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/main-layout";
import { ThemeProvider } from "@/context/theme";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, hasHttpStatus } from "@/lib/api-errors";
import { AuthProvider, useAuth } from "@/context/auth";
import LandingPage from "@/pages/landing";
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
import AiReviewPage from "@/pages/ai-review";
import AiMetricsPage from "@/pages/ai-metrics";
import AssistedApplyPage from "@/pages/assisted-apply";
import FreelancePage from "@/pages/freelance";
import ApplyWizardPage from "@/pages/apply-wizard";
import RegisterPage from "@/pages/register";
import VerifyEmailPage from "@/pages/verify-email";
import ResetPasswordPage from "@/pages/reset-password";
import TermsOfServicePage from "@/pages/terms";
import PrivacyPolicyPage from "@/pages/privacy";
import RoleProfilesPage from "@/pages/role-profiles";
import FeedbackPage from "@/pages/feedback";
import GuidePage from "@/pages/guide";
import AccountPage from "@/pages/account";
import AdminUsersPage from "@/pages/admin/users";
import AdminInviteCodesPage from "@/pages/admin/invite-codes";
import AdminUsageLimitsPage from "@/pages/admin/usage-limits";
import AdminDocsPage from "@/pages/admin/docs";
import AdminBestPracticesPage from "@/pages/admin/best-practices";
import AdminAiControlPlanePage from "@/pages/admin/ai-control-plane";
import AdminResetPage from "@/pages/admin/reset";
import AiLearningPage from "@/pages/ai-learning";
import TrendsPage from "@/pages/trends";
import ResourcesPage from "@/pages/resources";
import StatsPage from "@/pages/stats";
import PipelineDiagramPage from "@/pages/pipeline-diagram";
import ChatPage from "@/pages/chat";
import QuestsPage from "@/pages/quests";
import JobBoardPage from "@/pages/job-board";
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
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        if (hasHttpStatus(error, 401)) return false;
        return failureCount < 2;
      },
    },
  },
});

function ProtectedRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return (
      <div className="page fade-up">
        <div className="dim" style={{ padding: "60px 0", textAlign: "center", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    if (source || medium || campaign) {
      const existing = localStorage.getItem("jobops_utm");
      const prev = existing ? JSON.parse(existing) : {};
      localStorage.setItem("jobops_utm", JSON.stringify({
        source: source ?? prev.source ?? undefined,
        medium: medium ?? prev.medium ?? undefined,
        campaign: campaign ?? prev.campaign ?? undefined,
      }));
    }
  }, []);

  if (user === undefined) {
    return (
      <div className="page fade-up">
        <div className="dim" style={{ padding: "60px 0", textAlign: "center", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  const isAuthed = user !== null;

  return (
    <Routes>
      <Route path="/" element={isAuthed ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route
        path="/login"
        element={isAuthed ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthed ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route element={<MainLayout />}>
        <Route element={<ProtectedRoutes />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/apply-wizard" element={<ApplyWizardPage />} />
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/base-resume" element={<BaseResumePage />} />
          <Route path="/resume-versions" element={<ResumeVersionsPage />} />
          <Route path="/cover-letters" element={<CoverLettersPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/assisted-apply" element={<AssistedApplyPage />} />
          <Route path="/freelance" element={<FreelancePage />} />
          <Route path="/ai-review" element={<AiReviewPage />} />
          <Route path="/ai-metrics" element={<AiMetricsPage />} />
          <Route path="/ai-config" element={<AiConfigPage />} />
          <Route path="/role-profiles" element={<RoleProfilesPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/invite-codes" element={<AdminInviteCodesPage />} />
          <Route path="/admin/usage-limits" element={<AdminUsageLimitsPage />} />
          <Route path="/admin/docs" element={<AdminDocsPage />} />
          <Route path="/admin/best-practices" element={<AdminBestPracticesPage />} />
          <Route path="/admin/ai-control-plane" element={<AdminAiControlPlanePage />} />
          <Route path="/admin/reset" element={<AdminResetPage />} />
          <Route path="/ai-learning" element={<AiLearningPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/pipeline-diagram" element={<PipelineDiagramPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/quests" element={<QuestsPage />} />
          <Route path="/job-board" element={<JobBoardPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <BrowserRouter basename={base}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
