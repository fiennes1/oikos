import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.js";
import AppLogo from "../../components/AppLogo.jsx";
import ThemeToggle from "../../components/ThemeToggle.jsx";

const nav = [
  ["Dashboard", "/admin"],
  ["Competição", "/admin/competicao"],
  ["Atletas", "/admin/atletas"],
  ["Times", "/admin/times"],
  ["Provas", "/admin/provas"],
  ["Heats", "/admin/heats"],
  ["Resultados", "/admin/resultados"],
  ["Pontos", "/admin/pontos"],
];

export default function AdminShell({ title, children }) {
  const logout = useAuthStore((s) => s.logout);
  const routerNav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="admin-layout">
      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-black/50 md:hidden"
          aria-label="Fechar menu"
          onClick={closeMenu}
        />
      )}

      <aside
        className={`admin-aside fixed bottom-0 left-0 top-0 z-50 flex w-[min(18rem,88vw)] flex-col gap-1 transition-transform duration-200 ease-out md:static md:z-0 md:w-56 md:max-w-none md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="mb-4 flex flex-col gap-3 border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
          <Link
            to="/"
            onClick={closeMenu}
            className="inline-block shrink-0 rounded outline-none ring-2 ring-transparent focus-visible:ring-[color:var(--accent)]"
          >
            <AppLogo frame="aside" alt="Oikos" />
          </Link>
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-sm uppercase tracking-wider app-muted">Painel</p>
            <ThemeToggle className="hidden md:inline-flex" />
          </div>
        </div>
        {nav.map(([l, h]) => (
          <Link key={h} to={h} onClick={closeMenu} className="admin-aside-link min-h-[48px] py-3 leading-snug">
            {l}
          </Link>
        ))}
        <button
          type="button"
          className="mt-auto min-h-[48px] px-3 py-3 text-left text-sm"
          style={{ color: "#f87171" }}
          onClick={() => {
            closeMenu();
            logout();
            routerNav("/admin/login");
          }}
        >
          Sair
        </button>
      </aside>

      <div className="admin-content admin-content-area">
        <header className="mb-4 flex items-center justify-between gap-3 border-b pb-4 md:hidden" style={{ borderColor: "var(--border-color)" }}>
          <Link to="/" className="shrink-0 outline-none ring-2 ring-transparent focus-visible:ring-[color:var(--accent)]" onClick={closeMenu}>
            <AppLogo frame="asideMobile" alt="Oikos" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-lg leading-none"
              style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
            <ThemeToggle />
          </div>
        </header>

        <h1 className="mb-6 font-display text-[clamp(1.35rem,5vw,1.875rem)] md:text-3xl" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}
