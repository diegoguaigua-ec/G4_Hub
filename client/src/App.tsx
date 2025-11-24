import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import LandingPage from "@/pages/landing-page";
import PendingApprovalPage from "@/pages/pending-approval";

// Dashboard Pages
import OverviewPage from "@/pages/dashboard/overview";
import StoresPage from "@/pages/dashboard/stores/index";
import IntegrationsPage from "@/pages/dashboard/integrations/index";
import ContificoModulesPage from "@/pages/dashboard/integrations/contifico/index";
import ContificoInventoryPage from "@/pages/dashboard/integrations/contifico/inventory";
import SyncLogsPage from "@/pages/dashboard/sync-logs";
import AutomationPage from "@/pages/dashboard/automation";
import AnalyticsPage from "@/pages/dashboard/analytics";
import SettingsPage from "@/pages/dashboard/settings";

// Admin Pages
import AdminDashboard from "@/pages/dashboard/admin/index";
import AdminUsersPage from "@/pages/dashboard/admin/users";
import AuditLogsPage from "@/pages/dashboard/admin/audit-logs";

function Router() {
  return (
    <Switch>
      {/* Landing Page - shows marketing content or redirects to dashboard if authenticated */}
      <Route path="/" component={LandingPage} />

      {/* Pending Approval */}
      <Route path="/pending" component={PendingApprovalPage} />

      {/* Dashboard Routes */}
      <ProtectedRoute path="/dashboard" component={OverviewPage} />
      <ProtectedRoute path="/dashboard/stores" component={StoresPage} />
      <ProtectedRoute path="/dashboard/integrations" component={IntegrationsPage} />
      <ProtectedRoute path="/dashboard/integrations/contifico" component={ContificoModulesPage} />
      <ProtectedRoute path="/dashboard/integrations/contifico/inventory" component={ContificoInventoryPage} />
      <ProtectedRoute path="/dashboard/sync-logs" component={SyncLogsPage} />
      <ProtectedRoute path="/dashboard/automation" component={AutomationPage} />
      <ProtectedRoute path="/dashboard/analytics" component={AnalyticsPage} />
      <ProtectedRoute path="/dashboard/settings" component={SettingsPage} />

      {/* Admin Routes */}
      <ProtectedRoute path="/dashboard/admin" component={AdminDashboard} />
      <ProtectedRoute path="/dashboard/admin/users" component={AdminUsersPage} />
      <ProtectedRoute path="/dashboard/admin/audit-logs" component={AuditLogsPage} />

      {/* Auth */}
      <Route path="/auth" component={AuthPage} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;