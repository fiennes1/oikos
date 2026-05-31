import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import PublicNav from "../../components/PublicNav.jsx";
import { formatScore } from "../../utils/formatScore.js";

export default function EventResults() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [comp, setComp] = useState(null);

  const load = () => {
    axios
      .get(`/api/public/events/${id}/results/`)
      .then((r) => setData(r.data))
      .catch(() => setData(null));
  };

  useEffect(() => {
    load();
    axios
      .get("/api/public/competition/info/")
      .then((r) => setComp(r.data))
      .catch(() => setComp(null));
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [id]);

  const results = useMemo(() => {
    const rows = data?.results || [];
    return [...rows].sort((a, b) => {
      const pa = a.display_position ?? a.position ?? 9999;
      const pb = b.display_position ?? b.position ?? 9999;
      return pa - pb;
    });
  }, [data?.results]);

  const individualResults = useMemo(() => data?.individual_results || [], [data?.individual_results]);
  const teamIndividualMode = data?.scoring_mode === "team_with_individual";

  const metric = data?.event?.metric_type || "seconds";

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
      <main className="app-main">
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link to="/" className="app-link font-medium">
            ← Início
          </Link>
          <span className="app-muted">|</span>
          <Link to="/baterias" className="app-link font-medium">
            Baterias
          </Link>
          <span className="app-muted">|</span>
          <Link to="/cronograma" className="app-link font-medium">
            Cronograma
          </Link>
        </div>

        <h1 className="mb-2 app-title-page">{data.event?.name}</h1>
        {data.event?.description && <p className="mb-6 max-w-3xl text-sm app-muted">{data.event.description}</p>}

        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Classificação desta prova
        </h2>
        <p className="mb-4 text-sm app-muted">
          {teamIndividualMode || comp?.mode === "team"
            ? "Ranking por time nesta prova."
            : "Ranking desta prova."}{" "}
          Atualização a cada 30s.
        </p>

        {results.length === 0 ? (
          <p className="app-card rounded-xl p-8 text-center app-muted">Ainda não há resultados lançados nesta prova.</p>
        ) : (
          <div className="table-panel">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-2 text-left">Pos</th>
                  <th className="px-4 py-2 text-left">Competidor</th>
                  <th className="px-4 py-2 text-right">Resultado</th>
                  <th className="px-4 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="px-4 py-2 rank-cell">
                      {r.display_position ?? r.position ?? "—"}
                      {r.is_tied && (
                        <span className="ml-1 text-xs text-amber-600 dark:text-amber-400" title="Empate — aguardando decisão">
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.athlete ? (
                        <Link className="app-link font-medium" to={`/atleta/${r.athlete}`}>
                          {r.athlete_name}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--text-primary)" }}>{r.team_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono app-muted">{formatScore(r.raw_score, metric)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: "var(--text-primary)" }}>
                      {r.points_earned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {teamIndividualMode && individualResults.length > 0 && (
          <>
            <h2 className="mt-10 mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Resultados individuais por atleta
            </h2>
            <div className="table-panel">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-2 text-left">Atleta</th>
                    <th className="px-4 py-2 text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {individualResults.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="px-4 py-2">
                        <Link className="app-link font-medium" to={`/atleta/${r.athlete}`}>
                          {r.athlete_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right font-mono app-muted">{formatScore(r.raw_score, metric)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
