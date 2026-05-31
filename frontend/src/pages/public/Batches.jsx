import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import PublicNav from "../../components/PublicNav.jsx";
import { groupHeats, heatStatusBadge, isLiveBatch } from "../../utils/groupHeats.js";
import { formatDateTimeBR } from "../../utils/formatDate.js";

export default function Batches() {
  const [data, setData] = useState({ heats: [], events: [], current_live_batch: null });
  const [filterEvent, setFilterEvent] = useState("");

  useEffect(() => {
    axios
      .get("/api/public/events/schedule/")
      .then((r) => {
        setData({
          heats: r.data?.heats || [],
          events: r.data?.events || [],
          current_live_batch: r.data?.current_live_batch || null,
        });
        if (r.data?.events?.[0] && !filterEvent) setFilterEvent(String(r.data.events[0].id));
      })
      .catch(() => setData({ heats: [], events: [], current_live_batch: null }));
  }, []);

  const batches = useMemo(() => {
    let heats = data.heats || [];
    if (filterEvent) heats = heats.filter((h) => String(h.event) === filterEvent);
    return groupHeats(heats);
  }, [data.heats, filterEvent]);

  const eventName = data.events.find((e) => String(e.id) === filterEvent)?.name;

  return (
    <div className="app-shell">
      <PublicNav />
      <main className="app-main">
        <h1 className="mb-2 app-title-page">Baterias</h1>
        <p className="mb-6 text-sm app-muted">Horários, raias e participantes — ideal para acompanhar no celular.</p>

        <label className="mb-6 block max-w-md text-sm">
          <span className="mb-1 block app-muted">Filtrar por prova</span>
          <select
            className="ui-field w-full"
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
          >
            {data.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </label>

        {batches.length === 0 ? (
          <p className="app-card rounded-xl p-8 text-center app-muted">
            Nenhuma bateria cadastrada{eventName ? ` para ${eventName}` : ""}.
          </p>
        ) : (
          <div className="space-y-4">
            {batches.map((b) => {
              const live = isLiveBatch(b, data.current_live_batch);
              const badge = heatStatusBadge(b.status);
              return (
                <section
                  key={`${b.event}-${b.heat_number}`}
                  className={`app-card overflow-hidden rounded-xl ${live ? "ring-2 ring-[color:var(--accent)]" : ""}`}
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
                    style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-table-head)" }}
                  >
                    <div>
                      <h2 className="font-display text-lg" style={{ color: "var(--text-primary)" }}>
                        Bateria {b.heat_number}
                      </h2>
                      <p className="text-xs app-muted">
                        {b.scheduled_time ? formatDateTimeBR(b.scheduled_time) : "Horário a definir"}
                      </p>
                    </div>
                    <span className={`${badge.className} shrink-0`}>{badge.label}</span>
                  </div>
                  <ul className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                    {b.lanes.map((lane) => (
                      <li key={lane.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="font-mono text-sm app-muted">Raia {lane.lane_number || 1}</span>
                        <span
                          className="min-w-0 flex-1 text-right font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {lane.label || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {filterEvent && (
          <p className="mt-8 text-center">
            <Link to={`/prova/${filterEvent}`} className="app-link font-semibold">
              Ver classificação desta prova →
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
