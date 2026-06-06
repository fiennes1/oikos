import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import HelpHint from "../../components/HelpHint.jsx";
import { btn, btnBlock, field, panel } from "../../ui/classes.js";
import { formatScore } from "../../utils/formatScore.js";

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
  const [comps, setComps] = useState([]);
  const [compId, setCompId] = useState("");
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [athletes, setAthletes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [results, setResults] = useState([]);
  const [form, setForm] = useState({
    athlete: "",
    team: "",
    raw_score: "",
    tiebreak_score: "",
    notes: "",
    position_override: "",
  });
  const [filterTeamId, setFilterTeamId] = useState("");
  const [jointTeamScore, setJointTeamScore] = useState(false);
  const [viewTab, setViewTab] = useState("entry");
  const [editingId, setEditingId] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.get("/admin/competitions/").then((r) => {
      setComps(r.data);
      const active = r.data.find((c) => c.is_active) || r.data[0];
      if (active && !compId) setCompId(String(active.id));
    });
  }, []);

  useEffect(() => {
    if (!compId) {
      setEvents([]);
      setEventId("");
      return;
    }
    api.get("/admin/events/wods/").then((r) => {
      const list = r.data.filter((e) => String(e.competition) === compId);
      setEvents(list);
      if (!eventId && list[0]) setEventId(String(list[0].id));
      else if (eventId && !list.some((e) => String(e.id) === eventId)) {
        setEventId(list[0] ? String(list[0].id) : "");
      }
    });
  }, [compId]);

  const selectedEvent = useMemo(() => events.find((e) => String(e.id) === eventId), [events, eventId]);

  useEffect(() => {
    if (!compId) {
      setAthletes([]);
      setTeams([]);
      return;
    }
    let cancelled = false;
    setLoadError("");
    Promise.all([
      api.get("/admin/athletes/", { params: { championship: compId } }),
      api.get("/admin/teams/", { params: { championship: compId } }),
    ])
      .then(([ra, rt]) => {
        if (!cancelled) {
          setAthletes(Array.isArray(ra.data) ? ra.data : ra.data?.results ?? []);
          setTeams(Array.isArray(rt.data) ? rt.data : rt.data?.results ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAthletes([]);
          setTeams([]);
          setLoadError("Não foi possível carregar atletas/times deste campeonato.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [compId]);

  useEffect(() => {
    setEditingId(null);
    setFilterTeamId("");
    setJointTeamScore(false);
    setForm({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "", position_override: "" });
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

  const isTeamJoint =
    selectedEvent?.scored_by === "team" && selectedEvent?.team_scoring_format !== "individual";
  const isTeamIndividual =
    selectedEvent?.scored_by === "team" && selectedEvent?.team_scoring_format === "individual";
  const showTeamFilter = !isTeamJoint && (isTeamIndividual || selectedEvent?.scored_by === "athlete");

  const filteredAthletes = useMemo(() => {
    if (!filterTeamId) return athletes;
    return athletes.filter((a) => String(a.team) === filterTeamId);
  }, [athletes, filterTeamId]);

  const rankingRows = useMemo(() => {
    const metric = selectedEvent?.metric_type || "seconds";
    const rows = [...results];
    const teamInd = isTeamIndividual;
    const display = teamInd
      ? rows.filter((r) => r.team && !r.athlete)
      : rows.filter((r) => (isTeamJoint ? r.team && !r.athlete : true));
    return display
      .sort((a, b) => {
        const pa = a.display_position ?? a.position ?? 9999;
        const pb = b.display_position ?? b.position ?? 9999;
        return pa - pb;
      })
      .map((r) => ({ ...r, formatted: formatScore(r.raw_score, metric) }));
  }, [results, selectedEvent, isTeamJoint, isTeamIndividual]);

  async function submit(e) {
    e.preventDefault();
    const base = {
      event: Number(eventId),
      raw_score: form.raw_score,
      tiebreak_score: form.tiebreak_score || null,
      notes: form.notes,
      position_override: form.position_override ? Number(form.position_override) : null,
    };

    if (jointTeamScore && filterTeamId && form.raw_score) {
      const members = athletes.filter((a) => String(a.team) === filterTeamId);
      if (!members.length) return;
      for (const a of members) {
        const existing = results.find((r) => r.athlete === a.id);
        const payload = { ...base, athlete: a.id, team: null };
        if (existing) await api.patch(`/admin/scores/results/${existing.id}/`, payload);
        else await api.post("/admin/scores/results/", payload);
      }
      setForm({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "", position_override: "" });
      setJointTeamScore(false);
      await refreshResults();
      return;
    }

    const payload = { ...base };
    if (selectedEvent?.scored_by === "team" && !isTeamIndividual) {
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
    setForm({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "", position_override: "" });
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
      position_override: r.position_override != null ? String(r.position_override) : "",
    });
    if (r.athlete) {
      const a = athletes.find((x) => x.id === r.athlete);
      if (a?.team) setFilterTeamId(String(a.team));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ athlete: "", team: "", raw_score: "", tiebreak_score: "", notes: "", position_override: "" });
  }

  async function removeResult(id) {
    const row = results.find((x) => x.id === id);
    const label = row?.athlete_name || row?.team_name || "este resultado";
    if (!confirm(`Excluir o resultado de ${label}?`)) return;
    try {
      await api.delete(`/admin/scores/results/${id}/`);
      if (editingId === id) cancelEdit();
      setResults((prev) => prev.filter((r) => r.id !== id));
      await refreshResults();
    } catch {
      alert("Não foi possível excluir o resultado. Tente novamente.");
      await refreshResults();
    }
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

  const scoredByTeam = selectedEvent?.scored_by === "team" && !isTeamIndividual;
  const participantHint = isTeamIndividual
    ? "Prova com métrica individual por atleta — o total do time é calculado automaticamente (soma/média/melhor conforme a prova)."
    : scoredByTeam
      ? "Pontuação conjunta por time — um lançamento por time."
      : "Pontuação por atleta — use o filtro de time para ver só os membros de um time.";

  return (
    <AdminShell title="Lançamento de Resultados">
      <div className="admin-results-pad">
        {comps.length > 1 && (
          <label className="mb-4 block w-full max-w-full md:max-w-md">
            <span className="mb-1 block text-sm font-medium text-emerald-800 dark:text-emerald-400">Campeonato</span>
            <select className={field} value={compId} onChange={(e) => setCompId(e.target.value)}>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? " (ativo)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {loadError && (
          <p className="mb-4 rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${viewTab === "entry" ? "border-[color:var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : ""}`}
            style={{ borderColor: "var(--border-color)" }}
            onClick={() => setViewTab("entry")}
          >
            Lançar
          </button>
          <button
            type="button"
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${viewTab === "ranking" ? "border-[color:var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : ""}`}
            style={{ borderColor: "var(--border-color)" }}
            onClick={() => setViewTab("ranking")}
          >
            Classificação desta prova
          </button>
        </div>

        <select className={`${field} mb-4 w-full max-w-full md:max-w-md`} value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.length === 0 ? (
            <option value="">— Nenhuma prova neste campeonato —</option>
          ) : (
            events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))
          )}
        </select>

        {selectedEvent && viewTab === "entry" && (
          <p className="mb-4 max-w-2xl text-sm text-emerald-800 dark:text-emerald-400">{participantHint}</p>
        )}

        {viewTab === "ranking" && (
          <section className={`${panel} mb-8 p-4`}>
            <h2 className="mb-3 font-semibold text-emerald-950 dark:text-emerald-50">Ranking da prova</h2>
            {rankingRows.length === 0 ? (
              <p className="text-sm app-muted">Sem resultados classificados ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "var(--border-color)" }}>
                      <th className="py-2 pr-2">Pos</th>
                      <th className="py-2 pr-2">Competidor</th>
                      <th className="py-2 pr-2 text-right">Resultado</th>
                      <th className="py-2 text-right">Pts</th>
                      <th className="py-2 pl-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rankingRows.map((r) => (
                      <tr key={r.id} className="border-b" style={{ borderColor: "var(--border-color)" }}>
                        <td className="py-2 pr-2 font-mono">
                          {r.display_position ?? r.position ?? "—"}
                          {r.is_tied && <span className="text-amber-600" title="Empate"> *</span>}
                        </td>
                        <td className="py-2 pr-2">{r.athlete_name || r.team_name}</td>
                        <td className="py-2 pr-2 text-right font-mono">{r.formatted}</td>
                        <td className="py-2 text-right">{r.points_earned}</td>
                        <td className="py-2 pl-2 text-right">
                          <button type="button" className={btnGhost} onClick={() => { setViewTab("entry"); startEdit(r); }}>
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isTeamIndividual && (
              <>
                <h3 className="mt-6 mb-2 text-sm font-semibold">Resultados individuais</h3>
                <ul className="space-y-1 text-sm">
                  {results
                    .filter((r) => r.athlete)
                    .map((r) => (
                      <li key={r.id}>
                        {r.athlete_name}: {formatScore(r.raw_score, selectedEvent?.metric_type)}
                      </li>
                    ))}
                </ul>
              </>
            )}
          </section>
        )}

        {viewTab === "entry" && (
        <>
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
          {showTeamFilter && teams.length > 0 && (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-emerald-800 dark:text-emerald-400">Filtrar por time</span>
              <select className={field} value={filterTeamId} onChange={(e) => setFilterTeamId(e.target.value)}>
                <option value="">— Todos os times —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {showTeamFilter && !isTeamJoint && (
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={jointTeamScore}
                onChange={(e) => setJointTeamScore(e.target.checked)}
                disabled={!filterTeamId}
              />
              <span className="text-sm text-emerald-800 dark:text-emerald-400">
                Pontuação conjunta — mesmo valor para todos os atletas do time selecionado
              </span>
            </label>
          )}
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
              {teams.length === 0 && compId && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Nenhum time cadastrado neste campeonato. Cadastre em Admin → Times.
                </p>
              )}
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
                {filteredAthletes.map((a) => (
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
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-emerald-800 dark:text-emerald-400">
              Posição manual (desempate)
            </span>
            <input
              className={field}
              type="number"
              min={1}
              placeholder="Opcional — sobrescreve posição automática"
              value={form.position_override}
              onChange={(e) => setForm({ ...form, position_override: e.target.value })}
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
        </>
        )}
      </div>
    </AdminShell>
  );
}
