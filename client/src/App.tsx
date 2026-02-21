import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Layout, { AuthProvider, useAuth } from "@/components/Layout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import Users from "@/pages/Users";
import Overview from "@/pages/Overview";
import Discussion from "@/pages/Discussion";
import Reports from "@/pages/Reports";
import CalendarEnhanced from "@/pages/CalendarEnhanced";
import Extensions from "@/pages/Extensions";
import Tasks from "@/pages/Tasks";
import AddEditTask from "@/pages/AddEditTask";
import KeySteps from "@/pages/keysteps";
import KeyStepsFullPage from "@/pages/KeyStepsFullPage";
import AddSubMilestone from "@/pages/AddSubMilestone";
import AddKeyStep from "@/pages/AddKeyStep";
import NotFound from "@/pages/not-found";

/* ---------------- PROTECTED ROUTE ---------------- */

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return null;
  if (!user) return null;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

/* ---------------- PROTECTED ROUTER ---------------- */

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>

      <Route path="/projects">
        <ProtectedRoute component={Projects} />
      </Route>

      <Route path="/users">
        <ProtectedRoute component={Users} />
      </Route>

      <Route path="/overview">
        <ProtectedRoute component={Overview} />
      </Route>

      <Route path="/discussion">
        <ProtectedRoute component={Discussion} />
      </Route>

      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>

      <Route path="/calendar">
        <ProtectedRoute component={CalendarEnhanced} />
      </Route>

      <Route path="/extensions">
        <ProtectedRoute component={Extensions} />
      </Route>

      <Route path="/tasks">
        <ProtectedRoute component={Tasks} />
      </Route>

      <Route path="/add-task">
        <ProtectedRoute component={AddEditTask} />
      </Route>

      <Route path="/keysteps">
        <ProtectedRoute component={KeySteps} />
      </Route>

      <Route path="/key-steps">
        <ProtectedRoute component={KeyStepsFullPage} />
      </Route>

      <Route path="/add-key-step">
        <ProtectedRoute component={AddKeyStep} />
      </Route>

      <Route path="/add-sub-milestone">
        <ProtectedRoute component={AddSubMilestone} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

/* ---------------- APP ROUTER (wrapped by AuthProvider) ---------------- */

function AppRouter() {
  const { user, isLoading } = useAuth();

  // While restoring the session, show nothing (avoids flash-redirect to login)
  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "hsl(var(--background))" }}>
        <div style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
          <div style={{ width: 40, height: 40, border: "3px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return <ProtectedRouter />;
}

/* ---------------- APP ROOT ---------------- */

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppRouter />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
