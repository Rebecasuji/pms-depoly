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
import KeySteps from "@/pages/keysteps"; // ✅ MATCHES FILE NAME
import NotFound from "@/pages/not-found";

/* ---------------- PROTECTED ROUTE ---------------- */

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

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

      <Route path="/keysteps">
        <ProtectedRoute component={KeySteps} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

/* ---------------- PUBLIC ROUTER ---------------- */

function Router() {
  const { user } = useAuth();

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
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
