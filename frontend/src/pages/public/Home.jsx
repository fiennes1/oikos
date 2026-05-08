import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import PublicNav from "../../components/PublicNav.jsx";

const REFRESH_MS = 30_000;

const FALLBACK_CATS = ["Rx", "Scaled", "Masters"];

const EVENT_TYPE_LABEL = {
  for_time: "For Time",
  amrap: "AMRAP",
  max_load: "Max Load",
  max_reps: "Max Reps",
  points: "Pontos",
  tiebreak: "Tiebreak",
};

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cat, setCat] = useState(() => searchParams.get("category") || "Rx");
  const [data, setData] = useState(null);
  const [comp, setComp] = useState(null);
  const [schedule, setSchedule] = useState({ events: [], heats: [] });

  const tabItems = useMemo(() => {
    if (comp?.mode === "team") return [];
    const list = Array.isArray(comp?.categories)
      ? comp.categories.filter((c) => c.applies_to === "athlete")
      : [];
    if (list.length)
      return list.map((c) => ({
        key: c.slug,
        label: c.name,
      }));
    return FALLBACK_CATS.map((name) => ({
      key: name.toLowerCase(),
      label: name,
    }));
  }, [comp]);

  const catsList = tabItems.map((t) => t.key);
  const cats = tabItems;

  useEffect(() => {
    if (!cats.length) return;
    const q = searchParams.get("category");
    if (q && catsList.includes(q)) {
      setCat(q);
      return;
    }
    if (!catsList.includes(cat)) {
      const f = catsList[0];
      setCat(f);
      const next = new URLSearchParams(searchParams);
      next.set("category", f);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, catsList, cat, setSearchParams, cats.length]);

  const setCatAndUrl = (c) => {
    setCat(c);
    const next = new URLSearchParams(searchParams);
    next.set("category", c);
    setSearchParams(next, { replace: true });
  };

  const load = async () => {
    try {
      const [lb, ci, sch] = await Promise.all([
        axios.get("/api/public/leaderboard/", { params: { category: cat } }),
        axios.get("/api/public/competition/info/"),
        axios.get("/api/public/events/schedule/"),
      ]);
      setData(lb.data);
      setComp(ci.data);
      setSchedule({
        events: sch.data?.events || [],
        heats: sch.data?.heats || [],
      });
    } catch {
      setData({ rows: [], category: cat, competition_id: null });
      setComp(null);
      setSchedule({ events: [], heats: [] });
    }
  };

  useEffect(() => {
    load();
  }, [cat]);

  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [cat]);

  const sortedEvents = useMemo(
    () => [...(schedule.events || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [schedule.events],
  );

  const heatCountByEvent = useMemo(() => {
    const m = {};
    for (const h of schedule.heats || []) {
      m[h.event] = (m[h.event] || 0) + 1;
    }
    return m;
  }, [schedule.heats]);

  return (
    <div className="app-shell">
      <PublicNav />
      <main className="app-main">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest app-muted">Competição</p>
          <h1 className="app-title-page">{comp?.name || "Leaderboard"}</h1>
          {comp && (
            <p className="mt-1 app-muted">
              {comp.start_date} — {comp.end_date} · atualização a cada 30s
            </p>
          )}
        </header>

        <section className="mb-14">
          <h2 className="app-heading-section">Provas</h2>
          <p className="mb-6 max-w-2xl text-sm app-muted">
            Clique em uma prova para ver a classificação e os participantes por categoria.
          </p>
          {sortedEvents.length === 0 ? (
            <p className="app-card rounded-xl border-dashed p-8 text-center app-muted">Nenhuma prova cadastrada ainda.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedEvents.map((ev) => (
                <Link key={ev.id} to={`/prova/${ev.id}`} className="app-card--interactive group min-h-0 w-full max-w-full">
                  <div className="mb-2 flex min-h-[1.75rem] flex-nowrap items-center gap-2 overflow-hidden">
                    <span className="tag-category max-w-[58%] truncate sm:max-w-none">
                      {ev.eligible_categories?.length
                        ? ev.eligible_categories.map((c) => (typeof c === "object" ? c.name : c)).join(", ")
                        : ev.eligible_category || "Todas"}
                    </span>
                    <span className="ml-auto shrink-0 whitespace-nowrap text-xs app-muted">{EVENT_TYPE_LABEL[ev.event_type] || ev.event_type}</span>
                  </div>
                  <h3
                    className="font-display text-[1.1rem] leading-snug transition-colors group-hover:opacity-90 md:text-xl"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {ev.name}
                  </h3>
                  {(ev.scheduled_at || ev.location) && (
                    <p className="mt-2 truncate text-xs app-muted">
                      {ev.scheduled_at && <span>{String(ev.scheduled_at).replace("T", " ").slice(0, 16)}</span>}
                      {ev.scheduled_at && ev.location && " · "}
                      {ev.location}
                    </p>
                  )}
                  <p className="app-link mt-3 inline-flex min-h-11 items-center text-sm font-medium">Ver participantes e ranking →</p>
                  {(heatCountByEvent[ev.id] ?? 0) > 0 && (
                    <p className="mt-1 text-xs app-muted">{heatCountByEvent[ev.id]} heat(s)</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="app-heading-section">Classificação geral</h2>
          <p className="mb-4 text-sm app-muted">Soma de pontos em todas as provas da competição.</p>

          <div className="-mx-4 mb-6 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:overflow-visible md:px-0">
            <div className="flex w-max min-w-full gap-2 pb-1 md:flex-wrap md:pb-0">
              {cats.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCatAndUrl(tab.key)}
                  className={`btn-filter ${cat === tab.key ? "btn-filter-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-panel">
            {(!data?.rows || data.rows.length === 0) && (
              <p className="p-8 text-center app-muted">Nenhum resultado nesta categoria ainda.</p>
            )}
            {data?.rows && data.rows.length > 0 && (
              <>
                <div className="space-y-3 p-4 md:hidden">
                  {(data.rows || []).map((row) => (
                    <div key={`${row.type}-${row.id}-m`} className="app-card rounded-xl p-4 shadow-sm">
                      <div className="flex gap-3">
                        <span className="rank-cell w-10 shrink-0">{row.overall_rank}</span>
                        <div className="min-w-0 flex-1">
                          {row.type === "athlete" ? (
                            <Link to={`/atleta/${row.id}`} className="font-semibold app-link">
                              {row.nickname || row.name}
                            </Link>
                          ) : (
                            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                              {row.name}
                            </span>
                          )}
                          {row.team_name && <span className="mt-0.5 block truncate text-sm app-muted">{row.team_name}</span>}
                        </div>
                      </div>
                      <p className="mt-3 text-sm app-muted">
                        <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                          {row.total_points} pts
                        </span>
                        {" · "}
                        {row.wins} vitória(s)
                      </p>
                    </div>
                  ))}
                </div>

                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="table-head">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Atleta / Time</th>
                      <th className="px-4 py-3 text-right">Pts</th>
                      <th className="px-4 py-3 text-right">Vitórias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.rows || []).map((row) => (
                      <tr key={`${row.type}-${row.id}`} className="table-row animate-[fadeIn_0.4s_ease]">
                        <td className="w-14 px-4 py-3 rank-cell">{row.overall_rank}</td>
                        <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                          {row.type === "athlete" ? (
                            <Link to={`/atleta/${row.id}`} className="font-semibold app-link">
                              {row.nickname || row.name}
                            </Link>
                          ) : (
                            <span className="font-semibold">{row.name}</span>
                          )}
                          {row.team_name && <span className="ml-2 text-xs app-muted">({row.team_name})</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-lg" style={{ color: "var(--text-primary)" }}>
                          {row.total_points}
                        </td>
                        <td className="px-4 py-3 text-right app-muted">{row.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </section>
      </main>
      <style>{`@keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }`}</style>
    </div>
  );
}
