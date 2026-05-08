import { useEffect, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import { btn, field, row } from "../../ui/classes.js";

export default function TeamsAdmin() {
  const [comps, setComps] = useState([]);
  const [championshipId, setChampionshipId] = useState("");
  const [teams, setTeams] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", athleteIds: [] });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", athleteIds: [] });

  const loadComps = () =>
    api.get("/admin/competitions/").then((r) => {
      setComps(r.data);
      const active = r.data.find((c) => c.is_active) || r.data[0];
      if (active && !championshipId) setChampionshipId(String(active.id));
    });

  const loadTeams = () => {
    if (!championshipId) return;
    api.get("/admin/teams/", { params: { championship: championshipId } }).then((r) => setTeams(r.data));
  };

  const loadAthletes = () => {
    if (!championshipId) return;
    api.get("/admin/athletes/", { params: { championship: championshipId } }).then((r) => setAthletes(r.data));
  };

  useEffect(() => {
    loadComps();
  }, []);

  useEffect(() => {
    loadTeams();
    loadAthletes();
  }, [championshipId]);

  function toggleAthlete(list, id, checked) {
    const set = new Set(list);
    if (checked) set.add(id);
    else set.delete(id);
    return Array.from(set);
  }

  async function create(e) {
    e.preventDefault();
    if (!championshipId) return;
    await api.post("/admin/teams/", {
      championship: Number(championshipId),
      name: form.name,
      description: form.description,
      athlete_ids: form.athleteIds,
    });
    setForm({ name: "", description: "", athleteIds: [] });
    loadTeams();
    loadAthletes();
  }

  async function removeTeam(id) {
    if (!confirm("Excluir este time? Os atletas ficam sem time.")) return;
    await api.delete(`/admin/teams/${id}/`);
    if (editingId === id) {
      setEditingId(null);
    }
    loadTeams();
    loadAthletes();
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      description: t.description || "",
      athleteIds: (t.athletes || []).map((a) => a.id),
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    await api.patch(`/admin/teams/${editingId}/`, {
      name: editForm.name,
      description: editForm.description,
      athlete_ids: editForm.athleteIds,
    });
    setEditingId(null);
    loadTeams();
    loadAthletes();
  }

  const panelCls = "rounded-xl border border-emerald-200/60 p-4 dark:border-emerald-800/40";

  return (
    <AdminShell title="Times">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm app-muted">
          Campeonato
          <select
            className={`${field} mt-1 block max-w-md`}
            value={championshipId}
            onChange={(e) => setChampionshipId(e.target.value)}
          >
            <option value="">—</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={create} className={`${panelCls} mb-8 space-y-4`}>
        <h2 className="font-semibold text-emerald-950 dark:text-emerald-50">Novo time</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className={`${field} w-full`}
            placeholder="Nome do time"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input className={field} placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-emerald-900 dark:text-emerald-200">Participantes do time</p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-emerald-200/50 p-3 dark:border-emerald-800/50">
            {athletes.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-500">Cadastre atletas neste campeonato primeiro.</p>
            ) : (
              athletes.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.athleteIds.includes(a.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        athleteIds: toggleAthlete(form.athleteIds, a.id, e.target.checked),
                      })
                    }
                  />
                  <span>
                    {a.name}
                    <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                      ({a.category_name || "—"})
                      {a.team_detail?.name && (
                        <span className="ml-1 text-amber-700 dark:text-amber-400">
                          — em &quot;{a.team_detail.name}&quot;
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-500">
            Ao marcar um atleta que já está em outro time, ele passa a integrar apenas este time.
          </p>
        </div>
        <button type="submit" className={`${btn} min-h-12 w-full md:w-auto`} disabled={!championshipId}>
          Criar time
        </button>
      </form>

      <h2 className="mb-3 font-semibold text-emerald-950 dark:text-emerald-50">Times cadastrados</h2>
      <ul className="space-y-3">
        {teams.map((t) => (
          <li key={t.id} className={`${row} flex-col items-stretch gap-3 bg-white/80 dark:bg-black/25 sm:flex-row sm:items-start`}>
            {editingId === t.id ? (
              <form onSubmit={saveEdit} className="w-full space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    className={field}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                  <input
                    className={`${field} min-w-[180px]`}
                    placeholder="Descrição"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-emerald-200/40 p-2 dark:border-emerald-800/40">
                  {athletes.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.athleteIds.includes(a.id)}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            athleteIds: toggleAthlete(editForm.athleteIds, a.id, e.target.checked),
                          })
                        }
                      />
                      <span>
                        {a.name}{" "}
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">({a.category_name || "—"})</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="submit" className={btn}>
                    Salvar
                  </button>
                  <button type="button" className={`${btn} bg-transparent opacity-80`} onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <strong className="text-emerald-950 dark:text-emerald-50">{t.name}</strong>
                  {t.description && <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-500">{t.description}</p>}
                  <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-400">
                    {(t.athletes || []).length === 0 ? (
                      "Nenhum atleta."
                    ) : (
                      <>
                        Membros:{" "}
                        {(t.athletes || [])
                          .map((x) => x.name)
                          .join(", ")}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={`${btn} !px-3 !py-1 text-xs`} onClick={() => startEdit(t)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded px-3 py-1 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    onClick={() => removeTeam(t.id)}
                  >
                    Excluir
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
