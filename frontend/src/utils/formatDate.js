/** Converte YYYY-MM-DD (ou datetime ISO) para DD/MM/YYYY. */
export function formatDateBR(value) {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return s;
}

/** Converte datetime ISO para DD/MM/YYYY HH:mm */
export function formatDateTimeBR(value) {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))/);
  if (m) {
    const [, y, mo, d, hh, mm] = m;
    const date = `${d}/${mo}/${y}`;
    return hh != null ? `${date} ${hh}:${mm}` : date;
  }
  return formatDateBR(s);
}

/** Extrai HH:mm de datetime ISO. */
export function formatTimeBR(value) {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  return "—";
}

/** YYYY-MM-DD a partir de valor ISO ou Date. */
export function toISODateString(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = value instanceof Date ? value : new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function isoDateToBR(iso) {
  if (!iso) return "";
  return formatDateBR(iso) === "—" ? "" : formatDateBR(iso);
}

export function brDateToISO(br) {
  const m = String(br).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${y}-${mo}-${d}`;
}
