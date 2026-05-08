import { useEffect, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import { btn, field } from "../../ui/classes.js";

function splitCategories(ac) {
  return Array.isArray(ac) ? ac.join(",") : "";
}

export default function CompetitionAdmin() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [edit, setEdit] = useState(null);
  const wide = `${field} mt-1 w-full max-w-xl`;

  function applyRowToEdit(c) {
    if (!c) {
      setEdit(null);
      return;
    }
    setEdit({
      ...c,
      active_categories: splitCategories(c.active_categories),
    });
  }

  async function reload() {
    const r = await api.get("/admin/competitions/");
    const list = r.data;
    setRows(list);
    return list;
  }

  useEffect(() => {
    reload().then((list) => {
      const cur = list.find((c) => c.is_active) || list[0];
      if (cur) {
        setSelectedId(cur.id);
        applyRowToEdit(cur);
      } else {
        setSelectedId(null);
        setEdit(null);
      }
    });
  }, []);

  function selectCompetition(id) {
    const c = rows.find((x) => x.id === id);
    setSelectedId(id);
    applyRowToEdit(c);
  }

  async function save(e) {
    e.preventDefault();
    if (!edit?.id) return;
    const { id, ...rest } = edit;
    const payload = {
      ...rest,
      active_categories: String(edit.active_categories || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    await api.patch(`/admin/competitions/${id}/`, payload);
    const list = await reload();
    const updated = list.find((c) => c.id === id);
    if (updated) applyRowToEdit(updated);
    alert("Salvo.");
  }

  async function remove() {
    if (!edit?.id) return;
    const msg = `Excluir permanentemente o campeonato "${edit.name}"?\n\nIsso remove provas, categorias, atletas, times e resultados vinculados.`;
    if (!confirm(msg)) return;
    await api.delete(`/admin/competitions/${edit.id}/`);
    const list = await reload();
    if (list.length === 0) {
      setSelectedId(null);
      setEdit(null);
      return;
    }
    const next = list[0];
    setSelectedId(next.id);
    applyRowToEdit(next);
  }

  if (!edit && rows.length === 0) {
    return (
      <AdminShell title="Competição">
        <p className="app-muted">Nenhum campeonato cadastrado.</p>
      </AdminShell>
    );
  }

  if (!edit) {
    return (
      <AdminShell title="Competição">
        <p className="app-muted">Carregando…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Configuração da competição">
      <div className="mb-6 w-full max-w-xl">
        <label className="block text-sm app-muted">
          Campeonato
          <select
            className={`${wide}`}
            value={selectedId ?? ""}
            onChange={(e) => selectCompetition(Number(e.target.value))}
          >
            {rows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_active ? " ★" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={save} className="w-full max-w-xl space-y-4">
        <label className="block text-sm text-emerald-800 dark:text-emerald-400">
          Nome
          <input className={wide} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex-1 text-sm text-emerald-800 dark:text-emerald-400">
            Início
            <input type="date" className={wide} value={edit.start_date} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} />
          </label>
          <label className="flex-1 text-sm text-emerald-800 dark:text-emerald-400">
            Fim
            <input type="date" className={wide} value={edit.end_date} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} />
          </label>
        </div>
        <label className="block text-sm text-emerald-800 dark:text-emerald-400">
          Modalidade do campeonato
          <select
            className={wide}
            value={edit.mode || "individual"}
            onChange={(e) => setEdit({ ...edit, mode: e.target.value })}
          >
            <option value="individual">Individual — ranking por categoria</option>
            <option value="team">Times — ranking por time</option>
            <option value="mixed">Individual e times — permite provas dos dois tipos</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-400">
          <input type="checkbox" checked={!!edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
          Campeonato ativo (destaque no público)
        </label>
        <label className="block text-sm text-emerald-800 dark:text-emerald-400">
          Categorias ativas (separadas por vírgula)
          <input className={wide} value={edit.active_categories} onChange={(e) => setEdit({ ...edit, active_categories: e.target.value })} />
        </label>
        <label className="block text-sm text-emerald-800 dark:text-emerald-400">
          Descrição
          <textarea className={`${wide} min-h-[80px]`} value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={`${btn} px-6 py-2`}>
            Salvar
          </button>
          <button type="button" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40" onClick={remove}>
            Excluir campeonato
          </button>
        </div>
      </form>

      <ul className="mt-8 space-y-1 text-sm app-muted">
        {rows.map((c) => (
          <li key={c.id}>
            {c.name} {c.is_active ? "★" : ""}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
