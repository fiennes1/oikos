import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuthStore } from "./store/auth.js";
import ThemeSync from "./components/ThemeSync.jsx";

const Home = lazy(() => import("./pages/public/Home.jsx"));
const Schedule = lazy(() => import("./pages/public/Schedule.jsx"));
const Batches = lazy(() => import("./pages/public/Batches.jsx"));
const EventResults = lazy(() => import("./pages/public/EventResults.jsx"));
const AthleteProfile = lazy(() => import("./pages/public/AthleteProfile.jsx"));
const Login = lazy(() => import("./pages/admin/Login.jsx"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard.jsx"));
const AthletesAdmin = lazy(() => import("./pages/admin/AthletesAdmin.jsx"));
const TeamsAdmin = lazy(() => import("./pages/admin/TeamsAdmin.jsx"));
const EventsAdmin = lazy(() => import("./pages/admin/EventsAdmin.jsx"));
const HeatsAdmin = lazy(() => import("./pages/admin/HeatsAdmin.jsx"));
const ResultsAdmin = lazy(() => import("./pages/admin/ResultsAdmin.jsx"));
const PointsAdmin = lazy(() => import("./pages/admin/PointsAdmin.jsx"));
const CompetitionAdmin = lazy(() => import("./pages/admin/CompetitionAdmin.jsx"));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      Carregando…
    </div>
  );
}

function PrivateRoute({ children }) {
  const access = useAuthStore((s) => s.access);
  const loc = useLocation();
  if (!access) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  return children;
}

export default function App() {
  return (
    <>
      <ThemeSync />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cronograma" element={<Schedule />} />
          <Route path="/baterias" element={<Batches />} />
          <Route path="/prova/:id" element={<EventResults />} />
          <Route path="/atleta/:id" element={<AthleteProfile />} />
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/atletas"
            element={
              <PrivateRoute>
                <AthletesAdmin />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/times"
            element={
              <PrivateRoute>
                <TeamsAdmin />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/provas"
            element={
              <PrivateRoute>
                <EventsAdmin />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/heats"
            element={
              <PrivateRoute>
                <HeatsAdmin />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/resultados"
            element={
              <PrivateRoute>
                <ResultsAdmin />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/pontos"
            element={
              <PrivateRoute>
                <PointsAdmin />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/competicao"
            element={
              <PrivateRoute>
                <CompetitionAdmin />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
