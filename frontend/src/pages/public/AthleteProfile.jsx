import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import PublicNav from "../../components/PublicNav.jsx";

export default function AthleteProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`/api/public/athletes/${id}/profile/`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [id]);

  if (!data) {
    return (
      <div className="app-shell">
        <PublicNav />
        <p className="p-8 text-center app-muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <PublicNav />
      <main className="app-main max-w-4xl">
        <Link to="/" className="app-link text-sm font-medium">
          ← Leaderboard
        </Link>
        <div className="mt-4 flex items-center gap-4">
          {data.athlete?.photo && (
            <img
              src={data.athlete.photo}
              alt=""
              className="h-20 w-20 rounded-full border object-cover"
              style={{ borderColor: "var(--border-color)" }}
            />
          )}
          <div>
            <h1 className="app-title-page">{data.athlete?.name}</h1>
            <p className="app-muted">
              {data.athlete?.nickname} · {data.athlete?.category}
              {data.athlete?.team_detail?.name && ` · ${data.athlete.team_detail.name}`}
            </p>
            {data.overall && (
              <p className="mt-1 font-semibold app-link">
                Geral: {data.overall.overall_rank}º lugar · {data.overall.total_points} pts
              </p>
            )}
          </div>
        </div>
        <h2 className="mb-2 mt-8 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Provas
        </h2>
        <ul className="space-y-2">
          {data.results?.map((r) => (
            <li key={r.id} className="ui-row-list flex-wrap justify-between gap-2">
              <span style={{ color: "var(--text-primary)" }}>{r.event_name}</span>
              <span className="app-muted">
                {r.position}º — {r.raw_score} ({r.points_earned} pts)
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
