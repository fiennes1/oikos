
function batchStatus(lanes) {
  if (!lanes.length) return "pending";
  if (lanes.some((l) => l.status === "in_progress")) return "in_progress";
  if (lanes.every((l) => l.status === "done")) return "done";
  return lanes[0]?.status || "pending";
}

/** Agrupa registros de heat (uma linha por raia) em baterias. */
export function groupHeats(heats) {
  const map = new Map();
  for (const h of heats) {
    const key = `${h.event}-${h.heat_number}`;
    if (!map.has(key)) {
      map.set(key, {
        event: h.event,
        heat_number: h.heat_number,
        scheduled_time: h.scheduled_time,
        status: h.status,
        lanes: [],
      });
    }
    const batch = map.get(key);
    if (h.scheduled_time && !batch.scheduled_time) batch.scheduled_time = h.scheduled_time;
    batch.lanes.push(h);
  }
  for (const b of map.values()) {
    b.lanes.sort((a, c) => (a.lane_number || 0) - (c.lane_number || 0));
    b.status = batchStatus(b.lanes);
  }
  return [...map.values()].sort((a, b) => {
    if (a.scheduled_time && b.scheduled_time) {
      return String(a.scheduled_time).localeCompare(String(b.scheduled_time));
    }
    return a.heat_number - b.heat_number;
  });
}

export function heatStatusBadge(st) {
  if (st === "in_progress") return { label: "AO VIVO", className: "badge-status-live" };
  if (st === "done") return { label: "Concluído", className: "badge-status-done" };
  return { label: "Em breve", className: "badge-status-soon" };
}

export function isLiveBatch(batch, liveBatch) {
  if (!liveBatch) return batch.status === "in_progress";
  return (
    batch.event === liveBatch.event_id &&
    batch.heat_number === liveBatch.heat_number
  );
}