import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyThemeToDocument, useThemeStore } from "../store/theme.js";

/** Reforça data-theme quando o estado Zustand muda (ex.: toggle) ou ao trocar de rota. */
export default function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    applyThemeToDocument(theme);
  }, [theme, pathname]);

  return null;
}
