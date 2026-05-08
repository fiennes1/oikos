import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import PublicNav from "../../components/PublicNav.jsx";

const DEFAULT_CATS = ["Rx", "Scaled", "Masters", "Team"];

export default function EventResults() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [comp, setComp] = useState(null);
  const [activeCat, setActiveCat] = useState("Rx");

  const load = () => {
    axios
      .get(`/api/public/events/${id}/results/`)
      .then((r) => {
        setData(r.data);
        const ec = r.data?.event?.eligible_category;
        if (ec && (DEFAULT_CATS.includes(ec) || ec === "Team")) {
          setActiveCat(ec);
        }
      })
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

  const categories = comp?.active_categories?.length ? comp.active_categories : DEFAULT_CATS;

  const filteredResults = useMemo(() => {
    const rows = data?.results || [];
    return rows.filter((r) => (r.entry_category || "").toString() === activeCat);
  }, [data?.results, activeCat]);

  const eventEligible = data?.event?.eligible_category;

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
          <Link to="/cronograma" className="app-link font-medium">
            Cronograma
          </Link>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="tag-category font-bold">Prova · categoria base: {eventEligible}</span>
        </div>
        <h1 className="mb-2 app-title-page">{data.event?.name}</h1>
        {data.event?.description && <p className="mb-6 max-w-3xl text-sm app-muted">{data.event.description}</p>}

        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Participantes por categoria
        </h2>
        <p className="mb-4 text-sm app-muted">
          Só a categoria correspondente à prova contém resultados lançados. Nas outras abas não há dados para esta prova.
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCat(c)}
              className={`btn-filter ${activeCat === c ? "btn-filter-active" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>

        {activeCat !== eventEligible ? (
          <div
            className="rounded-2xl border p-6"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "color-mix(in srgb, var(--accent) 12%, var(--bg-card))",
              color: "var(--text-primary)",
            }}
          >
            <p className="font-medium">Esta prova é exclusiva da categoria {eventEligible}.</p>
            <p className="mt-2 text-sm app-muted">Não há classificação de {activeCat} neste WOD.</p>
            <Link to={`/?category=${encodeURIComponent(eventEligible)}`} className="mt-4 inline-block font-semibold app-link">
              Abrir classificação geral ({eventEligible}) →
            </Link>
          </div>
        ) : filteredResults.length === 0 ? (
          <p className="app-card rounded-xl p-8 text-center app-muted">Ainda não há resultados lançados nesta prova.</p>
        ) : (
          <div className="table-panel">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-2 text-left">Pos</th>
                  <th className="px-4 py-2 text-left">Competidor</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="px-4 py-2 rank-cell">{r.position}</td>
                    <td className="px-4 py-2">
                      {r.athlete ? (
                        <Link className="app-link font-medium" to={`/atleta/${r.athlete}`}>
                          {r.athlete_name}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--text-primary)" }}>{r.team_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono app-muted">{r.raw_score}</td>
                    <td className="px-4 py-2 text-right" style={{ color: "var(--text-primary)" }}>
                      {r.points_earned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
