import { useEffect, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";

const cardClass = "rounded-xl border p-4";
const cardStyle = { borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" };

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/admin/dashboard/").then((r) => setD(r.data));
  }, []);

  return (
    <AdminShell title="Dashboard">
      {!d?.competition && <p className="app-muted">Sem competição atual.</p>}
      {d?.competition && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className={cardClass} style={cardStyle}>
            <h2 className="mb-2 font-semibold app-link">Próximos heats</h2>
            <ul className="space-y-2 text-sm app-muted">
              {d.upcoming_heats?.map((h) => (
                <li key={h.id}>
                  {h.event_name} H{h.heat_number} — {h.athlete_name || h.team_name}
                </li>
              ))}
            </ul>
          </section>
          <section className={cardClass} style={cardStyle}>
            <h2 className="mb-2 font-semibold app-link">Últimos resultados</h2>
            <ul className="space-y-2 text-sm app-muted">
              {d.recent_results?.map((r) => (
                <li key={r.id}>
                  {r.event_name}: {r.athlete_name || r.team_name} — {r.raw_score} ({r.points_earned} pts)
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
