import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuthStore } from "./store/auth.js";
import ThemeSync from "./components/ThemeSync.jsx";
import Home from "./pages/public/Home.jsx";
import Schedule from "./pages/public/Schedule.jsx";
import EventResults from "./pages/public/EventResults.jsx";
import AthleteProfile from "./pages/public/AthleteProfile.jsx";
import Login from "./pages/admin/Login.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import AthletesAdmin from "./pages/admin/AthletesAdmin.jsx";
import TeamsAdmin from "./pages/admin/TeamsAdmin.jsx";
import EventsAdmin from "./pages/admin/EventsAdmin.jsx";
import HeatsAdmin from "./pages/admin/HeatsAdmin.jsx";
import ResultsAdmin from "./pages/admin/ResultsAdmin.jsx";
import PointsAdmin from "./pages/admin/PointsAdmin.jsx";
import CompetitionAdmin from "./pages/admin/CompetitionAdmin.jsx";

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
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/cronograma" element={<Schedule />} />
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
    </>
  );
}
