import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../../api/client.js";
import { useAuthStore } from "../../store/auth.js";
import { useThemeStore } from "../../store/theme.js";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import loginLogoSrc from "../../oks.png";
import { btnBlock, field } from "../../ui/classes.js";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const loc = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const theme = useThemeStore((s) => s.theme);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const { data } = await api.post("/auth/token/", { username, password });
      setTokens(data.access, data.refresh);
      nav(loc.state?.from?.pathname || "/admin", { replace: true });
    } catch {
      setErr("Credenciais inválidas.");
    }
  }

  return (
    <div
      className="app-shell relative flex min-h-screen w-full items-center justify-center px-4"
      style={{ colorScheme: theme === "dark" ? "dark" : "light" }}
    >
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <form onSubmit={submit} className="app-card w-full max-w-sm space-y-4 rounded-2xl p-8 shadow-lg">
        <div className="flex justify-center">
          <span className="app-logo-frame app-logo-frame--login">
            <img src={loginLogoSrc} alt="Oikos Leaderboard" loading="eager" />
          </span>
        </div>
        <h1 className="text-center font-display text-2xl" style={{ color: "var(--text-primary)" }}>
          Entrar no painel
        </h1>
        {err && <p className="text-center text-sm" style={{ color: "#f87171" }}>{err}</p>}
        <input className={field} placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        <input
          type="password"
          className={field}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" className={btnBlock}>
          Entrar
        </button>
        <p className="text-center text-sm app-muted">
          <Link to="/" className="app-link font-semibold">
            Página pública
          </Link>
        </p>
      </form>
    </div>
  );
}
