import { useEffect, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import { btn, field } from "../../ui/classes.js";

export default function PointsAdmin() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ position: "", points: "" });

  useEffect(() => {
    api.get("/admin/events/wods/").then((r) => {
      setEvents(r.data);
      if (r.data[0]) setEventId(String(r.data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    api.get("/admin/scores/points/", { params: { event: eventId } }).then((r) => setRows(r.data.sort((a, b) => a.position - b.position)));
  }, [eventId]);

  async function add(e) {
    e.preventDefault();
    await api.post("/admin/scores/points/", {
      event: Number(eventId),
      position: Number(form.position),
      points: Number(form.points),
    });
    setForm({ position: "", points: "" });
    const r = await api.get("/admin/scores/points/", { params: { event: eventId } });
    setRows(r.data.sort((a, b) => a.position - b.position));
  }

  return (
    <AdminShell title="Tabela de pontos">
      <select className={`${field} mb-4 w-full md:max-w-md`} value={eventId} onChange={(e) => setEventId(e.target.value)}>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <form onSubmit={add} className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-2">
        <input
          className={field}
          placeholder="Posição (1, 2, …)"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
        />
        <input className={field} placeholder="Pontos" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
        <button type="submit" className={`${btn} min-h-12 w-full md:w-auto`}>
          Adicionar / atualizar
        </button>
      </form>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-emerald-800 dark:text-emerald-500">
              <th className="py-2">Posição</th>
              <th>Pontos</th>
            </tr>
          </thead>
          <tbody className="text-emerald-950 dark:text-emerald-100">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-emerald-200/50 dark:border-emerald-800/40">
                <td className="py-2">{r.position}</td>
                <td>{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="ui-panel flex items-center justify-between gap-3 p-4">
            <span className="font-mono text-lg font-semibold text-emerald-800 dark:text-emerald-300">{r.position}º</span>
            <div className="min-w-0 flex-1 text-right">
              <p className="font-semibold text-emerald-950 dark:text-emerald-50">{r.points} pontos</p>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
