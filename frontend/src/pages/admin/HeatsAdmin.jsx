import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import BrDateInput from "../../components/BrDateInput.jsx";
import { btn, field } from "../../ui/classes.js";
import { formatTimeBR, toISODateString } from "../../utils/formatDate.js";

function localToISO(dateStr, hh, mm) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
}

export default function HeatsAdmin() {
  const [comps, setComps] = useState([]);
  const [compId, setCompId] = useState("");
  const [events, setEvents] = useState([]);
  const [scheduleDate, setScheduleDate] = useState(() => toISODateString(new Date()));

  const [heatEventId, setHeatEventId] = useState("");
  const [heatRows, setHeatRows] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [batchParticipantType, setBatchParticipantType] = useState("athlete");
  const [batchForm, setBatchForm] = useState({
    heat_number: 1,
    time: "08:00",
    lane_count: 4,
    assignments: ["", "", "", ""],
  });

  const compEvents = useMemo(() => events, [events]);
  const selectedComp = useMemo(() => comps.find((c) => String(c.id) === compId), [comps, compId]);
  const selectedHeatEvent = useMemo(
    () => compEvents.find((e) => String(e.id) === heatEventId),
    [compEvents, heatEventId],
  );
  const champMode = selectedComp?.mode || "individual";

  const heatBatches = useMemo(() => {
    const map = new Map();
    for (const h of heatRows) {
      const key = h.heat_number;
      if (!map.has(key)) {
        map.set(key, { heat_number: key, time: h.scheduled_time, lanes: [] });
      }
      map.get(key).lanes.push(h);
    }
    return [...map.values()].sort((a, b) => a.heat_number - b.heat_number);
  }, [heatRows]);

  useEffect(() => {
    api.get("/admin/competitions/").then((r) => {
      setComps(r.data);
      const a = r.data.find((c) => c.is_active) || r.data[0];
      if (a && !compId) setCompId(String(a.id));
    });
  }, []);

  useEffect(() => {
    if (!compId) return;
    api.get("/admin/events/wods/").then((r) => {
      const list = r.data.filter((e) => String(e.competition) === compId);
      setEvents(list);
      if (!heatEventId && list[0]) setHeatEventId(String(list[0].id));
      else if (heatEventId && !list.some((e) => String(e.id) === heatEventId)) {
        setHeatEventId(list[0] ? String(list[0].id) : "");
      }
    });
  }, [compId]);

  useEffect(() => {
    if (selectedComp?.start_date) {
      setScheduleDate(selectedComp.start_date);
    }
  }, [selectedComp?.start_date, compId]);

  useEffect(() => {
    if (!compId) {
      setAthletes([]);
      setTeams([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get("/admin/athletes/", { params: { championship: compId } }),
      api.get("/admin/teams/", { params: { championship: compId } }),
    ]).then(([ra, rt]) => {
      if (!cancelled) {
        setAthletes(ra.data);
        setTeams(rt.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [compId]);

  useEffect(() => {
    if (champMode === "team") setBatchParticipantType("team");
    else if (champMode === "individual") setBatchParticipantType("athlete");
  }, [champMode, heatEventId]);

  async function reloadHeats() {
    if (!heatEventId) {
      setHeatRows([]);
      return;
    }
    const r = await api.get("/admin/events/heats/", { params: { event: heatEventId } });
    setHeatRows(r.data.sort((a, b) => a.heat_number - b.heat_number || a.lane_number - b.lane_number));
  }

  useEffect(() => {
    if (!heatEventId) return;
    reloadHeats();
  }, [heatEventId]);

  function setBatchLaneCount(countStr) {
    const n = Math.max(1, Math.min(20, Number(countStr) || 1));
    setBatchForm((prev) => {
      const assignments = [...prev.assignments];
      while (assignments.length < n) assignments.push("");
      return { ...prev, lane_count: n, assignments: assignments.slice(0, n) };
    });
  }

  async function createBatch(e) {
    e.preventDefault();
    if (!heatEventId) return;
    const scoredByTeam =
      batchParticipantType === "team" ||
      selectedHeatEvent?.scored_by === "team" ||
      champMode === "team";
    const [hh, mm] = batchForm.time.split(":").map(Number);
    const scheduled_time = localToISO(scheduleDate, hh, mm || 0);
    const lanes = batchForm.assignments.slice(0, batchForm.lane_count).map((val, i) => {
      const lane = { lane_number: i + 1 };
      if (val) {
        if (scoredByTeam) lane.team = Number(val);
        else lane.athlete = Number(val);
      }
      return lane;
    });
    await api.post("/admin/events/heats/batch/", {
      event: Number(heatEventId),
      heat_number: Number(batchForm.heat_number),
      scheduled_time,
      lanes,
    });
    setBatchForm((prev) => ({
      ...prev,
      heat_number: Number(prev.heat_number) + 1,
      assignments: prev.assignments.map(() => ""),
    }));
    await reloadHeats();
  }

  async function onStartBatch(batch) {
    await api.post("/admin/events/heats/start-batch/", {
      event: Number(heatEventId),
      heat_number: batch.heat_number,
    });
    await reloadHeats();
  }

  return (
    <AdminShell title="Baterias (Heats / Raias)">
      <p className="mb-6 max-w-2xl text-sm app-muted">
        Cadastre baterias com horário e raias para cada prova. Ao trocar o campeonato, a data padrão é a{" "}
        <strong>data de início do campeonato</strong>.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-8">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Campeonato</span>
          <select className={`${field} w-full`} value={compId} onChange={(e) => setCompId(e.target.value)}>
            <option value="">—</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Dia da bateria</span>
          <BrDateInput className={field} value={scheduleDate} onChange={setScheduleDate} />
        </label>
      </div>

      {!compId && <p className="mb-6 app-muted">Selecione um campeonato.</p>}

      {compId && compEvents.length === 0 && (
        <p className="mb-6 rounded-lg border border-dashed px-4 py-3 text-sm app-muted" style={{ borderColor: "var(--border-color)" }}>
          Nenhuma prova neste campeonato. Cadastre provas em <strong>Provas (WODs)</strong>.
        </p>
      )}

      {compId && compEvents.length > 0 && (
        <>
          <label className="mb-6 block max-w-md">
            <span className="mb-1 block text-sm text-emerald-800 dark:text-emerald-400">Prova</span>
            <select className={`${field} w-full`} value={heatEventId} onChange={(e) => setHeatEventId(e.target.value)}>
              {compEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          {heatEventId && (
            <form
              onSubmit={createBatch}
              className="mb-8 grid max-w-2xl grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-2"
              style={{ borderColor: "var(--border-color)" }}
            >
              <h2 className="font-display text-lg md:col-span-2" style={{ color: "var(--text-primary)" }}>
                Nova bateria
              </h2>
              {champMode === "mixed" && (
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs app-muted">Tipo desta bateria</span>
                  <select
                    className={field}
                    value={batchParticipantType}
                    onChange={(e) => setBatchParticipantType(e.target.value)}
                  >
                    <option value="team">Times</option>
                    <option value="athlete">Atletas</option>
                  </select>
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs app-muted">Nº da bateria</span>
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={batchForm.heat_number}
                  onChange={(e) => setBatchForm({ ...batchForm, heat_number: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs app-muted">Horário</span>
                <input
                  type="time"
                  className={field}
                  value={batchForm.time}
                  onChange={(e) => setBatchForm({ ...batchForm, time: e.target.value })}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs app-muted">Quantidade de raias</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className={field}
                  value={batchForm.lane_count}
                  onChange={(e) => setBatchLaneCount(e.target.value)}
                />
              </label>
              {batchForm.assignments.slice(0, batchForm.lane_count).map((val, i) => {
                const scoredByTeam =
                  batchParticipantType === "team" ||
                  selectedHeatEvent?.scored_by === "team" ||
                  champMode === "team";
                const options = scoredByTeam ? teams : athletes;
                return (
                  <label key={i} className="block">
                    <span className="mb-1 block text-xs app-muted">Raia {i + 1}</span>
                    <select
                      className={field}
                      value={val}
                      onChange={(e) => {
                        const assignments = [...batchForm.assignments];
                        assignments[i] = e.target.value;
                        setBatchForm({ ...batchForm, assignments });
                      }}
                    >
                      <option value="">— vazio —</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {scoredByTeam ? o.name : o.nickname || o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <button type="submit" className={`${btn} md:col-span-2`}>
                Salvar bateria
              </button>
            </form>
          )}

          {heatEventId && heatBatches.length === 0 && (
            <p className="mb-4 text-sm app-muted">Nenhuma bateria cadastrada para esta prova ainda.</p>
          )}

          <ul className="space-y-3">
            {heatBatches.map((batch) => {
              return (
                <li
                  key={batch.heat_number}
                  className="rounded-lg border px-3 py-3"
                  style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      Bateria {batch.heat_number} · {batch.time ? formatTimeBR(batch.time) : "—"}
                    </span>
                    <button
                      type="button"
                      className={`${btn} min-h-10 text-xs`}
                      onClick={() => onStartBatch(batch)}
                      disabled={batch.lanes[0]?.status === "in_progress"}
                    >
                      {batch.lanes[0]?.status === "in_progress" ? "Ao vivo" : "Iniciar bateria"}
                    </button>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {[...batch.lanes]
                      .sort((a, b) => (a.lane_number || 0) - (b.lane_number || 0))
                      .map((h) => (
                        <li key={h.id} className="flex gap-2 app-muted">
                          <span className="w-14 shrink-0 font-mono">Raia {h.lane_number || 1}</span>
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {h.athlete_name || h.team_name || "— vazio —"}
                          </span>
                        </li>
                      ))}
                  </ul>
                  {batch.lanes[0]?.status === "in_progress" && (
                    <p className="mt-2 text-xs font-semibold uppercase text-[color:var(--accent)]">Ao vivo</p>
                  )}
                  {batch.lanes[0]?.status === "done" && (
                    <p className="mt-2 text-xs font-semibold uppercase app-muted">Concluída</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
