import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import HelpHint from "../../components/HelpHint.jsx";
import { btn, field, row } from "../../ui/classes.js";

const ORDER_HINT =
  "Não é tempo nem duração da prova. É a ordem para exibir esta prova nas listas e no cronograma (menor número tende a aparecer antes quando não há horário definido). Use 0, 1, 2… para sequenciar os WODs.";

const emptyEditForm = () => ({
  name: "",
  event_type: "for_time",
  scored_by: "athlete",
  eligibleCategoryId: "",
  display_order: 0,
  location: "",
});

export default function EventsAdmin() {
  const [comps, setComps] = useState([]);
  const [categories, setCategories] = useState([]);
  const [events, setEvents] = useState([]);
  const [compId, setCompId] = useState("");
  const [form, setForm] = useState({
    competition: "",
    name: "",
    event_type: "for_time",
    scored_by: "athlete",
    eligibleCategoryId: "",
    display_order: 0,
    location: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const loadComps = () =>
    api.get("/admin/competitions/").then((r) => {
      setComps(r.data);
      const active = r.data.find((c) => c.is_active) || r.data[0];
      if (active && !compId) {
        setCompId(String(active.id));
        setForm((f) => ({ ...f, competition: String(active.id) }));
      }
    });

  const loadCategories = () => {
    if (!compId) return;
    api.get("/admin/categories/", { params: { championship: compId } }).then((r) => setCategories(r.data));
  };

  const loadEvents = () => {
    if (!compId) return;
    api.get("/admin/events/wods/").then((r) => setEvents(r.data.filter((e) => String(e.competition) === compId)));
  };

  useEffect(() => {
    loadComps();
  }, []);

  useEffect(() => {
    loadCategories();
    loadEvents();
    setEditingId(null);
  }, [compId]);

  const categoryOptions = useMemo(() => {
    const preferred = ["Iniciante", "Scaled", "Intermediário", "Rx", "Masters"];
    const list = [...categories].sort((a, b) => {
      const ia = preferred.indexOf(a.name);
      const ib = preferred.indexOf(b.name);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return list.filter((c) => c.applies_to === "athlete");
  }, [categories]);

  async function create(e) {
    e.preventDefault();
    const eligible_category_ids = form.eligibleCategoryId ? [Number(form.eligibleCategoryId)] : [];
    await api.post("/admin/events/wods/", {
      competition: Number(form.competition || compId),
      name: form.name,
      event_type: form.event_type,
      scored_by: form.scored_by || "athlete",
      display_order: Number(form.display_order),
      location: form.location || "",
      eligible_category_ids,
    });
    setForm((f) => ({
      ...f,
      name: "",
      display_order: (Number(f.display_order) || 0) + 1,
    }));
    loadEvents();
  }

  function startEdit(ev) {
    const cats = ev.eligible_categories || [];
    setEditingId(ev.id);
    setEditForm({
      name: ev.name,
      event_type: ev.event_type,
      scored_by: ev.scored_by || "athlete",
      display_order: ev.display_order,
      location: ev.location || "",
      eligibleCategoryId: cats.length === 1 ? String(cats[0].id) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyEditForm());
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    const eligible_category_ids = editForm.eligibleCategoryId ? [Number(editForm.eligibleCategoryId)] : [];
    await api.patch(`/admin/events/wods/${editingId}/`, {
      name: editForm.name,
      event_type: editForm.event_type,
      scored_by: editForm.scored_by || "athlete",
      display_order: Number(editForm.display_order),
      location: editForm.location || "",
      eligible_category_ids,
    });
    cancelEdit();
    loadEvents();
  }

  async function remove(ev) {
    const msg = `Excluir permanentemente a prova "${ev.name}"?\n\nHeats e resultados desta prova serão removidos.`;
    if (!confirm(msg)) return;
    await api.delete(`/admin/events/wods/${ev.id}/`);
    if (editingId === ev.id) cancelEdit();
    loadEvents();
  }

  const eventCategoryLabel = (ev) => {
    if (ev.eligible_categories?.length) {
      return ev.eligible_categories.map((c) => (typeof c === "object" ? c.name : c)).join(", ");
    }
    return "Todas";
  };

  const btnGhost =
    "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors border-[color:var(--border-color)] text-[color:var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10";

  return (
    <AdminShell title="Provas (WODs)">
      <div className="mb-4 w-full max-w-full">
        <label className="mb-1 block text-sm text-emerald-800 dark:text-emerald-400">Competição</label>
        <select
          className={`${field} w-full`}
          value={compId}
          onChange={(e) => {
            const v = e.target.value;
            setCompId(v);
            setForm((f) => ({ ...f, competition: v }));
          }}
        >
          <option value="">—</option>
          {comps.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-4 max-w-2xl text-sm app-muted">
        As categorias elegíveis são as mesmas cadastradas no campeonato (como na tela <strong>Atletas</strong>). Deixe{" "}
        <strong>Todas</strong> para todas as divisões de atleta participarem.
      </p>

      <form
        onSubmit={create}
        className="mb-6 grid w-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-3 md:gap-y-2 lg:grid-cols-3"
      >
        <input type="hidden" name="competition" value={compId} />
        <input
          className={`${field} md:col-span-2 lg:col-span-3`}
          placeholder="Nome da prova"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select className={field} value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
          <option value="for_time">For Time</option>
          <option value="amrap">AMRAP</option>
          <option value="max_load">Max Load</option>
          <option value="tiebreak">Tiebreak</option>
        </select>
        <select className={field} value={form.scored_by} onChange={(e) => setForm({ ...form, scored_by: e.target.value })}>
          <option value="athlete">Pontuação por atleta</option>
          <option value="team">Pontuação por time</option>
        </select>
        <select
          className={field}
          value={form.eligibleCategoryId}
          onChange={(e) => setForm({ ...form, eligibleCategoryId: e.target.value })}
          disabled={!categoryOptions.length}
        >
          <option value="">Todas as categorias</option>
          {!categoryOptions.length && compId && <option value="">Cadastre categorias no campeonato</option>}
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1">
          <span className="flex items-center text-sm text-emerald-800 dark:text-emerald-400">
            Ordem de exibição
            <HelpHint title={ORDER_HINT} />
          </span>
          <input
            className={field}
            type="number"
            placeholder="Ex.: 0, 1, 2…"
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: e.target.value })}
          />
        </label>
        <input
          className={`${field} md:col-span-2 lg:col-span-3`}
          placeholder="Local"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <button type="submit" className={`${btn} min-h-12 w-full md:col-span-2 lg:col-span-3`} disabled={!compId}>
          Criar prova
        </button>
      </form>

      <h2 className="mb-3 font-semibold text-emerald-950 dark:text-emerald-50">Provas cadastradas</h2>
      <ul className="space-y-3">
        {events.map((ev) => (
          <li key={ev.id} className="rounded-xl border border-emerald-200/50 bg-white/80 p-3 dark:border-emerald-800/40 dark:bg-black/25">
            {editingId === ev.id ? (
              <form onSubmit={saveEdit} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <input
                  className={`${field} md:col-span-2 lg:col-span-3`}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
                <select className={field} value={editForm.event_type} onChange={(e) => setEditForm({ ...editForm, event_type: e.target.value })}>
                  <option value="for_time">For Time</option>
                  <option value="amrap">AMRAP</option>
                  <option value="max_load">Max Load</option>
                  <option value="tiebreak">Tiebreak</option>
                </select>
                <select
                  className={field}
                  value={editForm.scored_by}
                  onChange={(e) => setEditForm({ ...editForm, scored_by: e.target.value })}
                >
                  <option value="athlete">Pontuação por atleta</option>
                  <option value="team">Pontuação por time</option>
                </select>
                <select
                  className={field}
                  value={editForm.eligibleCategoryId}
                  onChange={(e) => setEditForm({ ...editForm, eligibleCategoryId: e.target.value })}
                  disabled={!categoryOptions.length}
                >
                  <option value="">Todas as categorias</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="flex flex-col gap-1">
                  <span className="flex items-center text-sm text-emerald-800 dark:text-emerald-400">
                    Ordem de exibição
                    <HelpHint title={ORDER_HINT} />
                  </span>
                  <input
                    className={field}
                    type="number"
                    placeholder="Ex.: 0, 1, 2…"
                    value={editForm.display_order}
                    onChange={(e) => setEditForm({ ...editForm, display_order: e.target.value })}
                  />
                </label>
                <input
                  className={`${field} md:col-span-2 lg:col-span-3`}
                  placeholder="Local"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
                {(ev.eligible_categories?.length || 0) > 1 && (
                  <p className="text-xs text-amber-800 dark:text-amber-400 md:col-span-2 lg:col-span-3">
                    Esta prova tinha várias categorias; ao salvar, a seleção acima substitui todas (use &quot;Todas&quot; para liberar todas as divisões).
                  </p>
                )}
                <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-3">
                  <button type="submit" className={`${btn} min-h-12`}>
                    Salvar alterações
                  </button>
                  <button type="button" className={btnGhost} onClick={cancelEdit}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className={`${row} border-0 bg-transparent p-0 dark:bg-transparent`}>
                <div className="min-w-0 flex-1">
                  <span className="font-medium leading-snug text-emerald-950 dark:text-emerald-50">{ev.name}</span>
                  <span className="mt-1 block text-xs text-emerald-800 dark:text-emerald-500 md:text-sm">
                    {ev.event_type} · {ev.scored_by === "team" ? "por time" : "por atleta"} · {eventCategoryLabel(ev)}
                  </span>
                </div>
                <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 md:w-auto">
                  <button type="button" className={btnGhost} onClick={() => startEdit(ev)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                    onClick={() => remove(ev)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
