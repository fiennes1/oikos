import { create } from "zustand";

const LEGACY_KEY = "cf-theme";

export function readStoredTheme() {
  if (typeof window === "undefined") return "dark";
  const plain = localStorage.getItem("theme");
  if (plain === "light" || plain === "dark") return plain;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const t = p?.state?.theme;
      if (t === "light" || t === "dark") {
        localStorage.setItem("theme", t);
        return t;
      }
    }
  } catch {
    /* ignore */
  }
  return "dark";
}

/** Aplica data-theme no <html> e persiste em localStorage.setItem('theme', …) */
export function applyThemeToDocument(theme) {
  if (typeof document === "undefined") return;
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
  document.documentElement.style.colorScheme = t === "dark" ? "dark" : "light";
}

const initialTheme = readStoredTheme();
applyThemeToDocument(initialTheme);

export const useThemeStore = create((set, get) => ({
  theme: initialTheme,
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyThemeToDocument(next);
    set({ theme: next });
  },
  setTheme: (theme) => {
    const t = theme === "dark" || theme === "light" ? theme : "dark";
    applyThemeToDocument(t);
    set({ theme: t });
  },
}));
