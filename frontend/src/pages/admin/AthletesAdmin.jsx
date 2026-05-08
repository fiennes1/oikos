import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import { btn, field, row } from "../../ui/classes.js";

export default function AthletesAdmin() {
  const [comps, setComps] = useState([]);
  const [championshipId, setChampionshipId] = useState("");
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    name: "",
    nickname: "",
    category: "",
    gender: "M",
  });

  const loadComps = () =>
    api.get("/admin/competitions/").then((r) => {
      setComps(r.data);
      const active = r.data.find((c) => c.is_active) || r.data[0];
      if (active && !championshipId) setChampionshipId(String(active.id));
    });

  const loadCategories = () => {
    if (!championshipId) return;
    api.get("/admin/categories/", { params: { championship: championshipId } }).then((r) => setCategories(r.data));
  };

  const loadAthletes = () => {
    if (!championshipId) return;
    api.get("/admin/athletes/", { params: { championship: championshipId } }).then((r) => setRows(r.data));
  };

  useEffect(() => {
    loadComps();
  }, []);

  useEffect(() => {
    loadCategories();
    loadAthletes();
  }, [championshipId]);

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

  useEffect(() => {
    if (!categoryOptions.length) {
      setForm((f) => ({ ...f, category: "" }));
      return;
    }
    setForm((f) => {
      if (f.category && categoryOptions.some((c) => String(c.id) === String(f.category))) return f;
      const rx = categoryOptions.find((c) => c.slug === "rx" || c.name === "Rx");
      return { ...f, category: String((rx || categoryOptions[0]).id) };
    });
  }, [categoryOptions]);

  async function create(e) {
    e.preventDefault();
    if (!championshipId || !form.category) return;
    const payload = {
      championship: Number(championshipId),
      name: form.name,
      nickname: form.nickname,
      category: Number(form.category),
      gender: form.gender,
    };
    await api.post("/admin/athletes/", payload);
    setForm({ name: "", nickname: "", category: form.category, gender: "M" });
    loadAthletes();
  }

  async function remove(id) {
    if (!confirm("Remover atleta?")) return;
    await api.delete(`/admin/athletes/${id}/`);
    loadAthletes();
  }

  const wideField = `${field} max-w-full md:max-w-xs`;

  return (
    <AdminShell title="Atletas">
      <div className="mb-4 flex w-full flex-wrap items-end gap-3">
        <label className="block w-full max-w-full text-sm app-muted md:max-w-xs">
          Campeonato
          <select
            className={`${wideField} mt-1 block w-full`}
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

      <p className="mb-4 max-w-2xl text-sm app-muted">
        Categorias disponíveis vêm do cadastro do campeonato. O vínculo com <strong>times</strong> é feito na tela{" "}
        <strong>Times</strong>.
      </p>

      <form onSubmit={create} className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-x-2">
        <input className={`${field} lg:col-span-2`} placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className={field} placeholder="Apelido" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
        <select
          className={field}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          required
          disabled={!categoryOptions.length}
        >
          {!categoryOptions.length && <option value="">Cadastre categorias no campeonato</option>}
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={field} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="M">M</option>
          <option value="F">F</option>
          <option value="O">Outro</option>
        </select>
        <button type="submit" className={`${btn} min-h-12 w-full lg:col-span-4`} disabled={!championshipId || !form.category}>
          Adicionar
        </button>
      </form>

      <ul className="space-y-2">
        {rows.map((a) => (
          <li key={a.id} className={`${row} bg-white/80 dark:bg-black/25`}>
            <span className="text-emerald-950 dark:text-emerald-100">
              {a.name}
              <span className="text-sm app-muted">
                {" "}
                ({a.category_name || a.category_slug || "—"})
                {a.team_detail?.name && (
                  <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-xs dark:bg-white/10">Time: {a.team_detail.name}</span>
                )}
              </span>
            </span>
            <button type="button" className="text-sm text-red-600 dark:text-red-400" onClick={() => remove(a.id)}>
              excluir
            </button>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
