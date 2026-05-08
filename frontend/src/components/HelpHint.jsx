import { useEffect, useId, useRef, useState } from "react";

/**
 * Ícone “?” — no desktop o title ainda mostra dica ao passar o mouse;
 * em qualquer dispositivo, toque/clique abre o texto completo em um balão.
 */
export default function HelpHint({ title }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative ml-1 inline-flex shrink-0 align-middle">
      <button
        type="button"
        className="inline-flex min-h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-current text-[11px] font-bold leading-none text-emerald-800 opacity-75 ring-offset-2 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] dark:text-emerald-400 touch-manipulation"
        aria-expanded={open}
        aria-controls={panelId}
        title={title}
        aria-label={open ? "Fechar explicação" : "Abrir explicação do campo"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        ?
      </button>
      {open && (
        <span
          id={panelId}
          role="tooltip"
          className="absolute left-0 top-full z-[70] mt-1 max-w-[min(22rem,calc(100vw-2rem))] rounded-lg border px-3 py-2 text-left text-xs font-normal normal-case leading-snug shadow-lg"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </span>
      )}
    </span>
  );
}
