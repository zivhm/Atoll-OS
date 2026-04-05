import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import ProtectedRoute from "@/components/ProtectedRoute";
import { GLOBAL_PASSWORD_FORM_ID } from "@/components/ui/input";

const Landing = lazy(() => import("./pages/Landing"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AgentChat = lazy(() => import("./pages/AgentChat"));
const AgentSetup = lazy(() => import("./pages/AgentSetup"));
const AgentSettings = lazy(() => import("./pages/AgentSettings"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const DevDocs = lazy(() => import("./pages/DevDocs"));
const AppLayout = lazy(() => import("./layouts/AppLayout"));
const NotFound = lazy(() => import("./pages/NotFound"));
const showPublicLanding = import.meta.env.VITE_PUBLIC_LANDING === "true";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="rounded-3xl border border-border/70 bg-card/85 px-6 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur">
        Loading Atoll...
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <form
          id={GLOBAL_PASSWORD_FORM_ID}
          aria-hidden="true"
          className="hidden"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        />
        <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route
                path="/"
                element={showPublicLanding ? <Landing /> : <Navigate to="/dashboard" replace />}
              />
              <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
              <Route element={<AuthProvider><ProtectedRoute><AppLayout /></ProtectedRoute></AuthProvider>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agents/new" element={<AgentSetup />} />
                <Route path="/agents/:agentId" element={<AgentChat />} />
                <Route path="/agents/:agentId/settings" element={<AgentSettings />} />
                <Route path="/settings" element={<AccountSettings />} />
                <Route path="/identities" element={<DevDocs />} />
                <Route path="/dev" element={<Navigate to="/identities" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
