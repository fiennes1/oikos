/** Formata raw_score conforme metric_type da prova para exibição pública/admin. */
export function formatScore(raw, metricType) {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(raw);
  if (Number.isNaN(n)) return String(raw);

  switch (metricType) {
    case "seconds": {
      const total = Math.round(n);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return m > 0 ? `${m}:${String(s).padStart(2, "0")} min` : `${s}s`;
    }
    case "kg":
      return `${n} kg`;
    case "reps":
      return `${n} reps`;
    case "rounds_reps":
      return String(raw);
    case "points":
      return `${n} pts`;
    default:
      return String(raw);
  }
}
