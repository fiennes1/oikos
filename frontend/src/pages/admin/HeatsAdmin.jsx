import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import api from "../../api/client.js";
import AdminShell from "./AdminShell.jsx";
import { btn, field } from "../../ui/classes.js";

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function localToISO(dateStr, hh, mm) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
}

function buildDaySlots() {
  const slots = [];
  const START = 6 * 60;
  const END = 22 * 60;
  for (let mins = START; mins <= END; mins += 30) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    slots.push({ hh, mm, label: `${String(hh).padStart(2, "0")}:${mm === 0 ? "00" : "30"}` });
  }
  return slots;
}

const DAY_SLOTS = buildDaySlots();

function slotDroppableId(dateStr, hh, mm) {
  return `slot-${dateStr}-${String(hh).padStart(2, "0")}${String(mm).padStart(2, "0")}`;
}

function parseSlotDroppableId(id) {
  const m = String(id).match(/^slot-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})$/);
  if (!m) return null;
  return { dateStr: m[1], hh: Number(m[2]), mm: Number(m[3]) };
}

function eventDayKey(iso) {
  if (!iso) return null;
  return formatYMD(new Date(iso));
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    fn();
    return () => mq.removeEventListener("change", fn);
  }, [breakpoint]);
  return isMobile;
}

const POOL_EVENTS_ID = "pool-events-open";

const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.5" } },
  }),
};

/** Tamanho fixo igual para todos os cartões de prova */
const EVENT_CARD_CLASS =
  "flex h-[120px] w-[120px] min-h-[120px] min-w-[120px] shrink-0 flex-col justify-between rounded-xl border p-2 shadow-sm";

/** Cartão quadrado da prova — arrastar no desktop; no mobile só toque abre modal */
function EventSquareCard({ ev, dragDisabled, onMobileSchedule }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event-${ev.id}`,
    disabled: dragDisabled,
  });

  const subtitle = [ev.event_type, ev.location].filter(Boolean).join(" · ");

  const mergedStyle = {
    borderColor: "var(--border-color)",
    backgroundColor: "var(--bg-card)",
    ...(transform && !dragDisabled
      ? {
          transform: `translate3d(${transform.x}px,${transform.y}px,0)`,
          zIndex: 50,
          opacity: isDragging ? 0.85 : 1,
        }
      : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      className={`${EVENT_CARD_CLASS} ${dragDisabled ? "cursor-pointer active:scale-[0.98]" : ""}`}
      onClick={() => {
        if (dragDisabled) onMobileSchedule?.(ev);
      }}
      role={dragDisabled ? "button" : undefined}
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {!dragDisabled && (
          <button
            type="button"
            className="mb-1 cursor-grab text-left text-lg leading-none text-[color:var(--text-secondary)] touch-none"
            {...listeners}
            {...attributes}
            aria-label="Arrastar prova"
            onClick={(e) => e.stopPropagation()}
          >
            ⋮⋮
          </button>
        )}
        <p className="line-clamp-4 text-center text-[11px] font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
          {ev.name}
        </p>
        {subtitle && (
          <p className="mt-1 line-clamp-2 text-center text-[9px] leading-tight text-[color:var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {dragDisabled && (
        <span className="mt-1 block text-center text-[9px] font-semibold leading-tight text-[color:var(--link)]">Toque p/ agendar</span>
      )}
    </div>
  );
}

function UnscheduledPool({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-3 transition-colors md:p-4 ${isOver ? "border-[color:var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : ""}`}
      style={{ borderColor: isOver ? undefined : "var(--border-color)" }}
    >
      {children}
    </div>
  );
}

function TimeSlotRow({ dateStr, hh, mm, label, children, isMobile, onMobileSlotTap }) {
  const id = slotDroppableId(dateStr, hh, mm);
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`relative flex gap-2 border-b py-2 transition-colors md:gap-4 ${isOver ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : ""}`}
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="w-14 shrink-0 pt-1 font-mono text-xs tabular-nums text-[color:var(--text-secondary)] md:w-16 md:text-sm">{label}</div>
      <div
        className="relative flex min-h-[56px] flex-1 flex-wrap content-start gap-2 rounded-lg border border-dashed p-2"
        style={{ borderColor: "var(--border-color)" }}
      >
        {isMobile && (
          <button
            type="button"
            className="absolute inset-0 z-10 rounded-lg bg-transparent md:hidden"
            aria-label={`Escolher prova para ${label}`}
            onClick={() => onMobileSlotTap?.({ hh, mm, label })}
          />
        )}
        <div className="relative z-0 flex w-full flex-wrap content-start gap-2">{children}</div>
      </div>
    </div>
  );
}

function ModalShell({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border bg-[color:var(--bg-card)] p-4 shadow-xl md:rounded-2xl"
        style={{ borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 font-display text-lg" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        {children}
        <button type="button" className={`${btn} mt-4 w-full min-h-12 md:mt-3`} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

export default function HeatsAdmin() {
  const isMobile = useIsMobile(768);
  const [comps, setComps] = useState([]);
  const [compId, setCompId] = useState("");
  const [events, setEvents] = useState([]);
  const [scheduleDate, setScheduleDate] = useState(() => formatYMD(new Date()));
  const [activeEventDrag, setActiveEventDrag] = useState(null);

  const [heatEventId, setHeatEventId] = useState("");
  const [heatRows, setHeatRows] = useState([]);

  const [timeModalEvent, setTimeModalEvent] = useState(null);
  const [slotModal, setSlotModal] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  useEffect(() => {
    api.get("/admin/competitions/").then((r) => {
      setComps(r.data);
      const a = r.data.find((c) => c.is_active) || r.data[0];
      if (a && !compId) setCompId(String(a.id));
    });
  }, []);

  useEffect(() => {
    if (!compId) return;
    api.get("/admin/events/wods/").then((r) => {
      const list = r.data.filter((e) => String(e.competition) === compId);
      setEvents(list);
      if (!heatEventId && list[0]) setHeatEventId(String(list[0].id));
      else if (heatEventId && !list.some((e) => String(e.id) === heatEventId)) {
        setHeatEventId(list[0] ? String(list[0].id) : "");
      }
    });
  }, [compId]);

  useEffect(() => {
    if (!heatEventId) return;
    api.get("/admin/events/heats/", { params: { event: heatEventId } }).then((r) => {
      setHeatRows(r.data.sort((a, b) => a.heat_number - b.heat_number));
    });
  }, [heatEventId]);

  const compEvents = useMemo(() => events.filter((e) => String(e.competition) === compId), [events, compId]);

  const { eventSlotted, eventPool } = useMemo(() => {
    const slottedMap = {};
    for (const s of DAY_SLOTS) {
      slottedMap[`${s.hh}-${s.mm}`] = [];
    }
    const poolList = [];

    for (const ev of compEvents) {
      const iso = ev.scheduled_at;
      if (!iso) {
        poolList.push({ ev, reason: "sem" });
        continue;
      }
      const day = eventDayKey(iso);
      if (day !== scheduleDate) {
        poolList.push({ ev, reason: "outro-dia" });
        continue;
      }
      const d = new Date(iso);
      const hh = d.getHours();
      const mm = d.getMinutes();
      const key = `${hh}-${mm}`;
      if (slottedMap[key]) {
        slottedMap[key].push(ev);
      } else {
        poolList.push({ ev, reason: "fora-grade" });
      }
    }

    return { eventSlotted: slottedMap, eventPool: poolList };
  }, [compEvents, scheduleDate]);

  async function patchEventScheduledAt(eventId, isoOrNull) {
    await api.patch(`/admin/events/wods/${eventId}/`, { scheduled_at: isoOrNull });
    const r = await api.get("/admin/events/wods/");
    setEvents(r.data.filter((e) => String(e.competition) === compId));
  }

  async function onDragEnd(evt) {
    const { active, over } = evt;
    setActiveEventDrag(null);
    if (!over) return;
    const aid = String(active.id);
    if (!aid.startsWith("event-")) return;
    const eid = Number(aid.replace("event-", ""));
    const overId = String(over.id);

    if (overId === POOL_EVENTS_ID) {
      await patchEventScheduledAt(eid, null);
      return;
    }
    const parsed = parseSlotDroppableId(overId);
    if (parsed?.dateStr === scheduleDate) {
      await patchEventScheduledAt(eid, localToISO(parsed.dateStr, parsed.hh, parsed.mm));
    }
  }

  async function onStartHeat(h) {
    await api.patch(`/admin/events/heats/${h.id}/`, { status: "in_progress" });
    if (heatEventId) {
      const r = await api.get("/admin/events/heats/", { params: { event: heatEventId } });
      setHeatRows(r.data.sort((a, b) => a.heat_number - b.heat_number));
    }
  }

  function shiftDay(delta) {
    const d = parseYMD(scheduleDate);
    d.setDate(d.getDate() + delta);
    setScheduleDate(formatYMD(d));
  }

  const activeEv = activeEventDrag ? compEvents.find((e) => e.id === activeEventDrag) : null;

  const scheduleGrid = (dragDisabled) => (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}>
      <div className="border-b px-3 py-2 md:px-4" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-table-head)" }}>
        <h2 className="font-display text-lg" style={{ color: "var(--text-primary)" }}>
          Quadro do dia · 30 em 30 min
        </h2>
      </div>
      <div className="max-h-[min(65vh,640px)] overflow-y-auto px-1 md:px-2">
        {DAY_SLOTS.map(({ hh, mm, label }) => {
          const key = `${hh}-${mm}`;
          const inSlot = eventSlotted[key] || [];
          return (
            <TimeSlotRow
              key={key}
              dateStr={scheduleDate}
              hh={hh}
              mm={mm}
              label={label}
              isMobile={isMobile}
              onMobileSlotTap={() => setSlotModal({ hh, mm, label })}
            >
              {inSlot.map((ev) => (
                <div key={ev.id} className="relative z-20 shrink-0">
                  <EventSquareCard
                    ev={ev}
                    dragDisabled={dragDisabled}
                    onMobileSchedule={() => setTimeModalEvent(ev)}
                  />
                </div>
              ))}
            </TimeSlotRow>
          );
        })}
      </div>
    </div>
  );

  const eventTilesRow = (inPool) => (
    <div className="flex flex-wrap justify-center gap-3 md:justify-start">
      {(inPool ? eventPool : []).map(({ ev, reason }) => (
        <div key={ev.id} className="flex w-[120px] shrink-0 flex-col items-center">
          <EventSquareCard
            ev={ev}
            dragDisabled={isMobile}
            onMobileSchedule={() => setTimeModalEvent(ev)}
          />
          {reason === "outro-dia" && ev.scheduled_at && (
            <p className="mt-1 max-w-[120px] text-center text-[10px] leading-snug text-amber-700 dark:text-amber-400">
              Outro dia: {String(ev.scheduled_at).replace("T", " ").slice(0, 16)}
            </p>
          )}
          {reason === "fora-grade" && (
            <p className="mt-1 max-w-[120px] text-center text-[10px] leading-snug text-amber-700 dark:text-amber-400">Fora da grade — reagende</p>
          )}
        </div>
      ))}
    </div>
  );

  const heatsSection = (
    <section className="mt-10 border-t pt-8" style={{ borderColor: "var(--border-color)" }}>
      <h2 className="mb-1 font-display text-xl" style={{ color: "var(--text-primary)" }}>
        Heats (atletas / times)
      </h2>
      <p className="mb-4 text-sm app-muted">
        Controle de heats por prova: iniciar pista, status. O quadro acima agenda <strong>quando cada prova acontece</strong>.
      </p>
      <label className="mb-3 block max-w-md">
        <span className="mb-1 block text-sm text-emerald-800 dark:text-emerald-400">Prova para ver heats</span>
        <select className={`${field} w-full`} value={heatEventId} onChange={(e) => setHeatEventId(e.target.value)}>
          {compEvents.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      {heatEventId && heatRows.length === 0 && (
        <p className="mb-4 text-sm app-muted">Nenhum heat cadastrado para esta prova ainda.</p>
      )}
      <ul className="space-y-2">
        {heatRows.map((h) => (
          <li
            key={h.id}
            className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}
          >
            <div>
              <span className="font-mono text-sm app-muted">H{h.heat_number}</span>
              <span className="ml-2 font-medium" style={{ color: "var(--text-primary)" }}>
                {h.athlete_name || h.team_name}
              </span>
              <span className="ml-2 text-xs uppercase text-[color:var(--text-secondary)]">{h.status}</span>
            </div>
            <button type="button" className={`${btn} min-h-11 w-full shrink-0 sm:w-auto`} onClick={() => onStartHeat(h)}>
              Iniciar heat
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <AdminShell title="Cronograma de Heats">
      <p className="mb-4 max-w-2xl text-sm app-muted">
        <strong>Provas</strong> aparecem nos quadradinhos abaixo.{" "}
        {isMobile ? (
          <>
            Toque numa <strong>prova</strong> para escolher o horário, ou toque num <strong>horário vazio</strong> na grade para escolher qual prova encaixa ali.
          </>
        ) : (
          <>
            Arraste cada prova para um horário da grade (6h–22h, de 30 em 30 min) ou para a área tracejada para <strong>limpar</strong> o horário neste dia.
          </>
        )}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-8">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Campeonato</span>
          <select className={`${field} w-full`} value={compId} onChange={(e) => setCompId(e.target.value)}>
            <option value="">—</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Dia</span>
          <div className="flex min-h-[44px] items-stretch gap-2">
            <button
              type="button"
              className={`${field} flex h-11 w-11 shrink-0 items-center justify-center px-0 py-0 text-xl leading-none`}
              onClick={() => shiftDay(-1)}
              aria-label="Dia anterior"
            >
              ‹
            </button>
            <input
              type="date"
              className={`${field} min-w-0 flex-1`}
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <button
              type="button"
              className={`${field} flex h-11 w-11 shrink-0 items-center justify-center px-0 py-0 text-xl leading-none`}
              onClick={() => shiftDay(1)}
              aria-label="Próximo dia"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {!compId && <p className="mb-6 app-muted">Selecione um campeonato.</p>}

      {compId && compEvents.length === 0 && (
        <p className="mb-6 rounded-lg border border-dashed px-4 py-3 text-sm app-muted" style={{ borderColor: "var(--border-color)" }}>
          Nenhuma prova neste campeonato. Cadastre provas em <strong>Provas (WODs)</strong>.
        </p>
      )}

      {compId && compEvents.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="mb-2 font-display text-lg" style={{ color: "var(--text-primary)" }}>
              Provas deste campeonato
            </h2>
            <p className="mb-3 text-xs app-muted md:text-sm">
              {isMobile ? "Toque num cartão para definir horário." : "Arraste pelo ícone ⋮⋮ para soltar na grade ou na área tracejada."}
            </p>
          </div>

          {isMobile ? (
            <>
              <div className="mb-6 rounded-xl border p-3 md:p-4" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Sem horário neste dia / outro horário
                </p>
                {eventPool.length === 0 ? (
                  <p className="text-sm italic app-muted">Todas as provas estão posicionadas na grade neste dia.</p>
                ) : (
                  eventTilesRow(true)
                )}
              </div>
              {scheduleGrid(true)}
              <DragOverlay>{null}</DragOverlay>
            </>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={({ active }) => {
                const id = String(active.id);
                if (id.startsWith("event-")) setActiveEventDrag(Number(id.replace("event-", "")));
              }}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveEventDrag(null)}
              dropAnimation={dropAnimation}
            >
              <UnscheduledPool id={POOL_EVENTS_ID}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Sem horário neste dia · arraste para cá para limpar
                </p>
                {eventPool.length === 0 ? (
                  <p className="text-sm italic app-muted">Nenhuma prova nesta área.</p>
                ) : (
                  eventTilesRow(true)
                )}
              </UnscheduledPool>

              <div className="mt-8">{scheduleGrid(false)}</div>

              <DragOverlay dropAnimation={dropAnimation}>
                {activeEv ? (
                  <div className={`${EVENT_CARD_CLASS} border-2 border-[color:var(--accent)] shadow-xl opacity-95`}>
                    <p className="line-clamp-6 text-center text-[11px] font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                      {activeEv.name}
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {heatsSection}
        </>
      )}

      <ModalShell open={!!timeModalEvent} title={timeModalEvent ? `Horário — ${timeModalEvent.name}` : ""} onClose={() => setTimeModalEvent(null)}>
        <p className="mb-3 text-sm app-muted">Dia do quadro: {scheduleDate}</p>
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {DAY_SLOTS.map((s) => (
            <button
              key={s.label}
              type="button"
              className="min-h-11 rounded-lg border text-sm font-medium"
              style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              onClick={() => {
                if (!timeModalEvent) return;
                patchEventScheduledAt(timeModalEvent.id, localToISO(scheduleDate, s.hh, s.mm));
                setTimeModalEvent(null);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-lg border py-2 text-sm text-red-700 dark:text-red-400"
          style={{ borderColor: "var(--border-color)" }}
          onClick={() => {
            if (timeModalEvent) patchEventScheduledAt(timeModalEvent.id, null);
            setTimeModalEvent(null);
          }}
        >
          Remover horário deste dia
        </button>
      </ModalShell>

      <ModalShell
        open={!!slotModal}
        title={slotModal ? `Encaixar prova às ${slotModal.label}` : ""}
        onClose={() => setSlotModal(null)}
      >
        <p className="mb-3 text-sm app-muted">Escolha qual prova começa neste horário.</p>
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {compEvents.map((ev) => (
            <button
              key={ev.id}
              type="button"
              className="rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              onClick={() => {
                if (!slotModal) return;
                patchEventScheduledAt(ev.id, localToISO(scheduleDate, slotModal.hh, slotModal.mm));
                setSlotModal(null);
              }}
            >
              {ev.name}
            </button>
          ))}
        </div>
      </ModalShell>
    </AdminShell>
  );
}
