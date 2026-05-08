import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import PublicNav from "../../components/PublicNav.jsx";

export default function Schedule() {
  const [data, setData] = useState({ heats: [], events: [], current_heat_id: null });

  const load = async () => {
    try {
      const res = await axios.get("/api/public/events/schedule/");
      setData(res.data);
    } catch {
      setData({ heats: [], events: [], current_heat_id: null });
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  function badge(st) {
    if (st === "in_progress") return <span className="badge-status-live shrink-0">AO VIVO</span>;
    if (st === "done") return <span className="badge-status-done shrink-0">Concluído</span>;
    return <span className="badge-status-soon shrink-0">Em breve</span>;
  }

  const byEvent = data.events?.map((ev) => ({
    ...ev,
    heats: data.heats.filter((h) => h.event === ev.id),
  }));

  return (
    <div className="app-shell">
      <PublicNav />
      <main className="app-main">
        <h1 className="app-title-page mb-2">Cronograma & Heats</h1>
        <p className="mb-8 text-sm app-muted">Destaque automático do heat atual (status em andamento).</p>
        <div className="space-y-6 md:space-y-8">
          {byEvent?.map((ev) => (
            <section key={ev.id} className="schedule-section overflow-hidden">
              <div className="schedule-section-head flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {ev.name}
                  </h2>
                  <p className="truncate text-xs app-muted">
                    {ev.scheduled_at || "—"} · {ev.location || "—"}
                  </p>
                </div>
                <Link
                  to={`/prova/${ev.id}`}
                  className="app-link inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-semibold sm:border-0 sm:px-0"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  Ver resultados →
                </Link>
              </div>
              <ul className="m-0 list-none p-0">
                {ev.heats.length === 0 && (
                  <li className="px-4 py-6 text-sm app-muted">Nenhum heat agendado.</li>
                )}
                {ev.heats.map((h) => (
                  <li
                    key={h.id}
                    className={`schedule-heat-row ${h.id === data.current_heat_id ? "schedule-heat-row--live" : ""}`}
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs app-muted">
                          Heat {h.heat_number}
                          {h.scheduled_time ? ` · ${String(h.scheduled_time).replace("T", " ").slice(11, 16)}` : ""}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                          {h.label}
                        </p>
                      </div>
                      <div className="shrink-0 pt-0.5">{badge(h.status)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
