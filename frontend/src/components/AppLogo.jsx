import logoForLightBg from "../oks_escuro.png";
import logoForDarkBg from "../oks_claro.png";
import { useThemeStore } from "../store/theme.js";

const FRAME_CLASS = {
  aside: "app-logo-frame--aside",
  asideMobile: "app-logo-frame--asideMobile",
  nav: "app-logo-frame--nav",
};

/**
 * Tema claro → oks_escuro; tema escuro → oks_claro.
 * Tamanhos fixos (altura + largura em calc) para a caixa ser idêntica em qualquer tema.
 */
export default function AppLogo({ frame = "aside", alt = "Oikos", className = "" }) {
  const theme = useThemeStore((s) => s.theme);
  const src = theme === "dark" ? logoForDarkBg : logoForLightBg;
  const fc = FRAME_CLASS[frame] ?? FRAME_CLASS.aside;

  return (
    <span className={`app-logo-frame ${fc} ${className}`.trim()}>
      <img src={src} alt={alt} loading="lazy" />
    </span>
  );
}
