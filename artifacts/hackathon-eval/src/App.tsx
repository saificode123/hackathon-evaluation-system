import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { AuthProvider, useAuth } from "./lib/auth";
import { EvaluatorDataProvider } from "./lib/evaluatorData";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import UsersPage from "./pages/admin/Users";
import EvaluatorDashboard from "./pages/evaluator/Dashboard";
import EvaluationForm from "./pages/evaluator/EvaluationForm";
import CoordinatorDashboard from "./pages/coordinator/Dashboard";
import Evaluations from "./pages/coordinator/Evaluations";
import Rankings from "./pages/coordinator/Rankings";
import Winners from "./pages/coordinator/Winners";
import Reports from "./pages/coordinator/Reports";
import GraceMarks from "./pages/coordinator/GraceMarks";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Redirect to={`/${user.role}`} />;
}

/** Single cache for all evaluator pages — fetch teams/problems once per session. */
function EvaluatorDataWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "evaluator") {
    return <EvaluatorDataProvider>{children}</EvaluatorDataProvider>;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <EvaluatorDataWrapper>
    <Layout>
      <Switch>
        <Route path="/" component={RootRedirect} />
        <Route path="/login" component={Login} />

        {/* Admin routes */}
        <Route path="/admin">
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute role="admin">
            <UsersPage />
          </ProtectedRoute>
        </Route>

        {/* Evaluator routes */}
        <Route path="/evaluator">
          <ProtectedRoute role="evaluator">
            <EvaluatorDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/evaluator/evaluate">
          <ProtectedRoute role="evaluator">
            <EvaluationForm />
          </ProtectedRoute>
        </Route>
        <Route path="/evaluator/evaluate/:evalId">
          {(params) => (
            <ProtectedRoute role="evaluator">
              <EvaluationForm editEvalId={params.evalId} />
            </ProtectedRoute>
          )}
        </Route>

        {/* Coordinator routes */}
        <Route path="/coordinator">
          <ProtectedRoute role="coordinator">
            <CoordinatorDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/coordinator/evaluations">
          <ProtectedRoute role="coordinator">
            <Evaluations />
          </ProtectedRoute>
        </Route>
        <Route path="/coordinator/rankings">
          <ProtectedRoute role="coordinator">
            <Rankings />
          </ProtectedRoute>
        </Route>
        <Route path="/coordinator/winners">
          <ProtectedRoute role="coordinator">
            <Winners />
          </ProtectedRoute>
        </Route>
        <Route path="/coordinator/reports">
          <ProtectedRoute role="coordinator">
            <Reports />
          </ProtectedRoute>
        </Route>
        <Route path="/coordinator/grace-marks">
          <ProtectedRoute role="coordinator">
            <GraceMarks />
          </ProtectedRoute>
        </Route>

        {/* Fallback */}
        <Route>
          <RootRedirect />
        </Route>
      </Switch>
    </Layout>
    </EvaluatorDataWrapper>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppRoutes />
      </WouterRouter>
    </AuthProvider>
  );
}
