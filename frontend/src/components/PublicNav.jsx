import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLogo from "./AppLogo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const links = [
  ["/", "Leaderboard"],
  ["/cronograma", "Cronograma"],
  ["/admin/login", "Admin"],
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  const close = () => setOpen(false);

  return (
    <>
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-3 outline-none ring-2 ring-transparent focus-visible:ring-[color:var(--accent)]"
            onClick={close}
          >
            <AppLogo frame="nav" alt="Oikos Leaderboard" />
          </Link>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <nav className="hidden items-center gap-4 md:flex">
              {links.map(([to, label]) => (
                <Link key={to} to={to} className={`app-nav-link inline-flex min-h-11 min-w-11 items-center justify-center px-2 ${to === "/admin/login" ? "app-nav-link--accent" : ""}`}>
                  {label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border md:hidden"
              style={{
                borderColor: "color-mix(in srgb, var(--text-nav) 35%, transparent)",
                color: "var(--text-nav)",
              }}
              aria-expanded={open}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "✕" : "☰"}
            </button>
            <ThemeToggle className="app-nav-theme-toggle shrink-0" />
          </div>
        </div>
      </header>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/50 md:hidden" aria-label="Fechar menu" onClick={close} />
          <div
            className={`fixed bottom-0 left-0 top-16 z-50 flex w-[min(18rem,88vw)] flex-col gap-1 border-r bg-[var(--bg-nav)] p-4 pt-6 shadow-xl transition-transform duration-200 ease-out md:hidden ${
              open ? "translate-x-0" : "-translate-x-full"
            }`}
            style={{ borderColor: "var(--border-color)" }}
          >
            {links.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                onClick={close}
                className={`min-h-12 rounded-lg px-4 py-3 text-base leading-snug text-[var(--text-nav)] ${to === "/admin/login" ? "font-semibold" : "opacity-90"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
