import logoClaro from "../oks_claro.png";
import logoEscuro from "../oks_escuro.png";
import { useThemeStore } from "../store/theme.js";

const FRAME_CLASS = {
  aside: "app-logo-frame--aside",
  asideMobile: "app-logo-frame--asideMobile",
  nav: "app-logo-frame--nav",
};

const LOGO_BY_VARIANT = {
  public: { light: logoClaro, dark: logoEscuro },
  admin: { light: logoEscuro, dark: logoClaro },
};

/**
 * Público: claro → oks_claro, escuro → oks_escuro.
 * Admin: claro → oks_escuro, escuro → oks_claro (fundo do painel).
 */
export default function AppLogo({ frame = "aside", alt = "Oikos", className = "", variant = "public" }) {
  const theme = useThemeStore((s) => s.theme);
  const pair = LOGO_BY_VARIANT[variant] ?? LOGO_BY_VARIANT.public;
  const src = theme === "dark" ? pair.dark : pair.light;
  const fc = FRAME_CLASS[frame] ?? FRAME_CLASS.aside;

  return (
    <span className={`app-logo-frame ${fc} ${className}`.trim()}>
      <img src={src} alt={alt} loading="lazy" />
    </span>
  );
}
