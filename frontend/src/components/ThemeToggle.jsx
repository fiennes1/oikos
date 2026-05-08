import { useThemeStore } from "../store/theme.js";

/** Mostra o tema para o qual o clique alterna: no modo claro → "Escuro 🌙"; no escuro → "Claro ☀️". */
export default function ThemeToggle({ className = "" }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <button type="button" onClick={() => toggle()} className={`theme-toggle-btn ${className}`} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}>
      {theme === "dark" ? (
        <>
          <span>Claro</span>
          <span aria-hidden>☀️</span>
        </>
      ) : (
        <>
          <span>Escuro</span>
          <span aria-hidden>🌙</span>
        </>
      )}
    </button>
  );
}
