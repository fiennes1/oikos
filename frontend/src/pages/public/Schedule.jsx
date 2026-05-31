import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import PublicNav from "../../components/PublicNav.jsx";
import { formatDateTimeBR } from "../../utils/formatDate.js";
import { groupHeats, heatStatusBadge, isLiveBatch } from "../../utils/groupHeats.js";

export default function Schedule() {
  const [data, setData] = useState({ heats: [], events: [], current_live_batch: null });

  const load = async () => {
    try {
      const res = await axios.get("/api/public/events/schedule/");
      setData({
        heats: res.data?.heats || [],
        events: res.data?.events || [],
        current_live_batch: res.data?.current_live_batch || null,
      });
    } catch {
      setData({ heats: [], events: [], current_live_batch: null });
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const byEvent = useMemo(() => {
    return (data.events || []).map((ev) => ({
      ...ev,
      batches: groupHeats((data.heats || []).filter((h) => h.event === ev.id)),
    }));
  }, [data.events, data.heats]);

  return (
    <div className="app-shell">
      <PublicNav />
      <main className="app-main">
        <h1 className="app-title-page mb-2">Cronograma & Baterias</h1>
        <p className="mb-8 text-sm app-muted">
          Cada bateria agrupa todos os times/atletas que competem no mesmo horário. O badge{" "}
          <strong>AO VIVO</strong> vale para a bateria inteira.
        </p>
        <div className="space-y-6 md:space-y-8">
          {byEvent?.map((ev) => (
            <section key={ev.id} className="schedule-section overflow-hidden">
              <div className="schedule-section-head flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {ev.name}
                  </h2>
                  <p className="truncate text-xs app-muted">
                    {ev.scheduled_at ? formatDateTimeBR(ev.scheduled_at) : "—"} · {ev.location || "—"}
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
                {ev.batches.length === 0 && (
                  <li className="px-4 py-6 text-sm app-muted">Nenhuma bateria agendada.</li>
                )}
                {ev.batches.map((b) => {
                  const live = isLiveBatch(b, data.current_live_batch);
                  const badge = heatStatusBadge(b.status);
                  return (
                    <li
                      key={`${b.event}-${b.heat_number}`}
                      className={`schedule-heat-row ${live ? "schedule-heat-row--live" : ""}`}
                    >
                      <div className="flex w-full items-start justify-between gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: "var(--border-color)" }}>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs app-muted">
                            Bateria {b.heat_number}
                            {b.scheduled_time ? ` · ${formatDateTimeBR(b.scheduled_time)}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          <span className={badge.className}>{badge.label}</span>
                        </div>
                      </div>
                      <ul className="m-0 list-none px-4 py-1">
                        {b.lanes.map((lane) => (
                          <li key={lane.id} className="flex justify-between gap-3 py-2 text-sm">
                            <span className="font-mono text-xs app-muted">Raia {lane.lane_number || 1}</span>
                            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                              {lane.label || "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
