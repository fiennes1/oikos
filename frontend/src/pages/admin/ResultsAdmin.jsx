import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import HelpHint from "../../components/HelpHint.jsx";
import { btn, btnBlock, field, panel } from "../../ui/classes.js";

const RAW_SCORE_HINT =
  "Performance principal nesta prova: For Time → tempo total em segundos (ex.: 285 = 4min45s); AMRAP → repetições completas; Max Load → kg; Max Reps → reps; Pontos → valor numérico conforme a prova. Use sempre o mesmo critério para todos neste WOD.";

const TIEBREAK_HINT =
  "Opcional. Preencha só quando existir critério extra de desempate (ex.: tempo parcial, reps no tie-break). Se dois empatarem no valor bruto, o sistema pode usar este número para ordenar. Deixe vazio se não houver tie-break.";

function athleteOptionLabel(a) {
  const base = (a.nickname || a.name || "").trim() || `Atleta #${a.id}`;
  const cat = a.category_name ? ` · ${a.category_name}` : "";
  return `${base}${cat}`;
}

export default function ResultsAdmin() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [athletes, setAthletes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [results, setResults] = useState([]);
  const [form, setForm] = useState({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "" });
  const [editingId, setEditingId] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.get("/admin/events/wods/").then((r) => {
      setEvents(r.data);
      if (r.data[0]) setEventId(String(r.data[0].id));
    });
  }, []);

  const selectedEvent = useMemo(() => events.find((e) => String(e.id) === eventId), [events, eventId]);

  useEffect(() => {
    const cid = selectedEvent?.competition;
    if (!cid) {
      setAthletes([]);
      setTeams([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get("/admin/athletes/", { params: { championship: cid } }),
      api.get("/admin/teams/", { params: { championship: cid } }),
    ]).then(([ra, rt]) => {
      if (!cancelled) {
        setAthletes(ra.data);
        setTeams(rt.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedEvent?.competition]);

  useEffect(() => {
    setEditingId(null);
    setForm({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "" });
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    api.get("/admin/scores/results/", { params: { event: eventId } }).then((r) => setResults(r.data));
  }, [eventId]);

  async function refreshResults() {
    if (!eventId) return;
    const r = await api.get("/admin/scores/results/", { params: { event: eventId } });
    setResults(r.data);
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      event: Number(eventId),
      raw_score: form.raw_score,
      tiebreak_score: form.tiebreak_score || null,
      notes: form.notes,
    };
    if (selectedEvent?.scored_by === "team") {
      payload.team = Number(form.team);
      payload.athlete = null;
      if (!form.team) return;
    } else {
      payload.athlete = Number(form.athlete);
      payload.team = null;
      if (!form.athlete) return;
    }
    if (editingId) {
      await api.patch(`/admin/scores/results/${editingId}/`, payload);
      setEditingId(null);
    } else {
      await api.post("/admin/scores/results/", payload);
    }
    setForm({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "" });
    await refreshResults();
  }

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      athlete: r.athlete != null ? String(r.athlete) : "",
      team: r.team != null ? String(r.team) : "",
      raw_score: r.raw_score != null && r.raw_score !== "" ? String(r.raw_score) : "",
      tiebreak_score: r.tiebreak_score != null && r.tiebreak_score !== "" ? String(r.tiebreak_score) : "",
      notes: r.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "" });
  }

  async function removeResult(id) {
    const row = results.find((x) => x.id === id);
    const label = row?.athlete_name || row?.team_name || "este resultado";
    if (!confirm(`Excluir o resultado de ${label}?`)) return;
    await api.delete(`/admin/scores/results/${id}/`);
    if (editingId === id) cancelEdit();
    await refreshResults();
  }

  async function doPreview() {
    if (!file || !eventId) return;
    const fd = new FormData();
    fd.append("event", eventId);
    fd.append("file", file);
    const r = await api.post("/admin/scores/results/preview-csv/", fd);
    setPreview(r.data);
  }

  async function doImport() {
    if (!file || !eventId) return;
    const fd = new FormData();
    fd.append("event", eventId);
    fd.append("file", file);
    const r = await api.post("/admin/scores/results/import-csv/", fd);
    alert(`Importados: ${r.data.created}. Erros: ${r.data.errors?.length || 0}`);
    await refreshResults();
  }

  const ghost = "rounded px-3 py-1 text-sm border border-emerald-300/50 bg-emerald-100/80 text-emerald-950 dark:border-emerald-700/50 dark:bg-emerald-950/60 dark:text-emerald-200";
  const btnGhost =
    "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors border-[color:var(--border-color)] text-[color:var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10";

  const scoredByTeam = selectedEvent?.scored_by === "team";
  const participantHint = scoredByTeam
    ? "Esta prova é pontuada por time — escolha um time do campeonato."
    : "Esta prova é pontuada por atleta — escolha um atleta inscrito no campeonato.";

  return (
    <AdminShell title="Lançamento de Resultados">
      <div className="admin-results-pad">
        <select className={`${field} mb-4 w-full max-w-full md:max-w-md`} value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        {selectedEvent && (
          <p className="mb-4 max-w-2xl text-sm text-emerald-800 dark:text-emerald-400">{participantHint}</p>
        )}

        {editingId && (
          <p className="mb-3 rounded-lg border border-amber-300/60 bg-amber-100/50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            Editando resultado existente. Ajuste os campos e salve, ou cancele.
          </p>
        )}

        <form
          id="results-entry-form"
          onSubmit={submit}
          className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-emerald-200/60 p-4 md:grid-cols-2 dark:border-emerald-800/40"
        >
          {scoredByTeam ? (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-emerald-800 dark:text-emerald-400">Time</span>
              <select
                className={field}
                required
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value, athlete: "" })}
              >
                <option value="">— Selecione o time —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-emerald-800 dark:text-emerald-400">Atleta</span>
              <select
                className={field}
                required
                value={form.athlete}
                onChange={(e) => setForm({ ...form, athlete: e.target.value, team: "" })}
              >
                <option value="">— Selecione o atleta —</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {athleteOptionLabel(a)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 flex items-center text-sm font-medium text-emerald-800 dark:text-emerald-400">
              Valor bruto
              <HelpHint title={RAW_SCORE_HINT} />
            </span>
            <input
              className={field}
              placeholder="Ex.: segundos, reps, kg…"
              value={form.raw_score}
              onChange={(e) => setForm({ ...form, raw_score: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center text-sm font-medium text-emerald-800 dark:text-emerald-400">
              Tie-break
              <HelpHint title={TIEBREAK_HINT} />
            </span>
            <input
              className={field}
              placeholder="Opcional"
              value={form.tiebreak_score}
              onChange={(e) => setForm({ ...form, tiebreak_score: e.target.value })}
            />
          </label>
          <input
            className={`${field} md:col-span-2`}
            placeholder="Observações"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:flex-wrap md:items-stretch">
            <button type="submit" className={`${btnBlock} hidden min-h-12 md:inline-flex md:flex-1`}>
              {editingId ? "Atualizar resultado" : "Salvar resultado"}
            </button>
            {editingId && (
              <button type="button" className={`${btnGhost} hidden min-h-12 md:inline-flex md:flex-1`} onClick={cancelEdit}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>

        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t p-4 md:hidden"
          style={{
            backgroundColor: "var(--bg-nav)",
            borderColor: "var(--border-color)",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex flex-col gap-2">
            <button type="submit" form="results-entry-form" className={`${btnBlock} min-h-12 w-full`}>
              {editingId ? "Atualizar resultado" : "Salvar resultado"}
            </button>
            {editingId && (
              <button type="button" className={`${btnGhost} min-h-12 w-full`} onClick={cancelEdit}>
                Cancelar edição
              </button>
            )}
          </div>
        </div>

        <div className={`${panel} mb-8 p-4`}>
          <h2 className="mb-2 font-semibold text-emerald-950 dark:text-emerald-50">CSV</h2>
          <p className="mb-2 text-sm text-emerald-800 dark:text-emerald-500">
            Colunas: athlete_id ou team_id, raw_score (ou raw_value legado), tiebreak_score opcional.
          </p>
          <input type="file" accept=".csv" className="w-full text-sm text-emerald-900 dark:text-emerald-300" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={`${ghost} min-h-11`} onClick={doPreview}>
              Preview
            </button>
            <button type="button" className={`${btn} min-h-11 text-xs`} onClick={doImport}>
              Importar
            </button>
          </div>
          {preview?.preview && (
            <pre className="mt-4 max-h-48 overflow-auto rounded bg-emerald-100/80 p-2 text-xs text-emerald-950 dark:bg-black/50 dark:text-emerald-200">
              {JSON.stringify(preview.preview, null, 2)}
            </pre>
          )}
        </div>

        <h2 className="mb-2 font-semibold text-emerald-950 dark:text-emerald-50">Resultados lançados</h2>
        <ul className="space-y-3 text-sm md:space-y-1">
          {results.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-emerald-200/40 px-3 py-3 md:flex-row md:items-center md:justify-between md:border-0 md:border-b md:py-2 dark:border-emerald-900/40"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-emerald-950 dark:text-emerald-100">
                  {r.athlete_name || r.team_name}: {r.raw_score}
                </span>
                {r.tiebreak_score != null && r.tiebreak_score !== "" && (
                  <span className="mt-0.5 block text-xs text-emerald-700 dark:text-emerald-500">
                    Tie-break: {r.tiebreak_score}
                  </span>
                )}
                {r.notes && (
                  <span className="mt-0.5 block text-xs italic text-emerald-700 dark:text-emerald-500">{r.notes}</span>
                )}
                <span className="mt-1 block text-emerald-700 dark:text-emerald-500">
                  {r.position}º · {r.points_earned} pts
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => startEdit(r)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={() => removeResult(r.id)}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}
