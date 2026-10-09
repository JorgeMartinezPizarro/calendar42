import { useEffect, useRef, useState } from 'react'
import { itemColor } from '../agendaTypes.js'
import { useNow } from '../hooks/useNow.js'
import { MIN_SLOT_MINUTES } from '../subscription.js'
import { addDays, formatLongDate, formatTime, isSameDay, startOfDay } from '../utils/date.js'
import './DayView.css'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const DEFAULT_SCROLL_HOUR = 8
const MINUTES_PER_DAY = 24 * 60
const SNAP_MINUTES = 15
// Por debajo de esta duración no caben dos líneas: nombre y hora van en una.
const COMPACT_MINUTES = 45

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatMinutes(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

/**
 * Recorta los elementos al día, calcula su posición vertical (en % del día) y
 * los reparte en carriles para que los que se solapan no se tapen.
 */
function layoutItems(items, date) {
  const dayStart = startOfDay(date)
  const dayEnd = addDays(dayStart, 1)

  const laidOut = items
    .filter((e) => e.beginAt < dayEnd && e.endAt > dayStart)
    .map((e) => {
      const start = e.beginAt < dayStart ? dayStart : e.beginAt
      const end = e.endAt > dayEnd ? dayEnd : e.endAt
      const startMin = (start - dayStart) / 60_000
      const endMin = Math.max(startMin + 20, (end - dayStart) / 60_000) // mínimo visible
      return { item: e, startMin, endMin, lane: 0, lanes: 1 }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  // Asignación de carriles por grupos de solapamiento.
  let group = []
  let groupEnd = -1
  const laneEnds = []

  const closeGroup = () => {
    const lanes = laneEnds.length || 1
    group.forEach((it) => (it.lanes = lanes))
    group = []
    laneEnds.length = 0
  }

  for (const it of laidOut) {
    if (it.startMin >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((end) => end <= it.startMin)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = it.endMin
    it.lane = lane
    group.push(it)
    groupEnd = Math.max(groupEnd, it.endMin)
  }
  closeGroup()

  return laidOut
}

function itemMeta(item) {
  const time = `${formatTime(item.beginAt)} – ${formatTime(item.endAt)}`
  switch (item.type) {
    case 'slot':
      return time
    case 'free':
      return `${time} · pulsa para agendar`
    case 'correction':
      return `${time} · ${item.role === 'corrector' ? 'corriges' : 'te corrigen'}${item.done ? ' · hecha' : ''}`
    default:
      return item.location ? `${time} · ${item.location}` : time
  }
}

/**
 * Vista diaria por horas.
 * - panel: ficha de un elemento. Mientras hay ficha, las horas desaparecen y
 *   la ficha ocupa su sitio (en móvil, toda la pantalla, por CSS).
 * - openItemId: id del elemento cuya ficha está abierta, para resaltarlo.
 * - onOpenItem(item): abrir la ficha (clic, Enter o Espacio).
 * - selectable: en el modo "Crear slots", arrastrar sobre las horas marca una
 *   franja (bloques de 15 min) y llama a onRangeSelect({ beginAt, endAt }).
 * - draft: franja ya marcada y pendiente de crear, que se dibuja en punteado.
 */
function DayView({
  date,
  items = [],
  status,
  panel = null,
  openItemId = null,
  onOpenItem,
  selectable = false,
  draft = null,
  onRangeSelect,
}) {
  const now = useNow()
  const scrollRef = useRef(null)
  const hoursRef = useRef(null)
  const [drag, setDrag] = useState(null) // { anchor, startMin, endMin } mientras se arrastra
  const isToday = isSameDay(date, now)
  const nowOffsetPct = ((now.getHours() * 60 + now.getMinutes()) / MINUTES_PER_DAY) * 100
  const laidOut = layoutItems(items, date)
  const showingPanel = Boolean(panel)

  // Al cambiar de día (o al volver de la ficha), llevar el scroll a la hora
  // actual (hoy) o a una hora razonable de la mañana, no a las 00:00.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const hourHeight = container.scrollHeight / HOURS.length
    const targetHour = isToday ? new Date().getHours() : DEFAULT_SCROLL_HOUR
    container.scrollTop = Math.max(0, (targetHour - 1) * hourHeight)
  }, [date, isToday, showingPanel])

  if (showingPanel) {
    return (
      <section className="dayview dayview--panel" aria-label="Detalle del elemento">
        <div className="dayview__panel">{panel}</div>
      </section>
    )
  }

  const openWithKeyboard = (item) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpenItem(item)
    }
  }

  // ---- arrastrar para marcar una franja (modo "Crear slots") ----------------
  const minutesAt = (clientY) => {
    const rect = hoursRef.current.getBoundingClientRect()
    const raw = ((clientY - rect.top) / rect.height) * MINUTES_PER_DAY
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES
    return Math.max(0, Math.min(MINUTES_PER_DAY, snapped))
  }

  const onPointerDown = (e) => {
    if (!selectable || e.button !== 0 || e.target.closest('.dayview__event')) return
    e.preventDefault()
    try {
      hoursRef.current.setPointerCapture(e.pointerId)
    } catch {
      // Sin captura el arrastre sigue funcionando mientras el puntero esté sobre la rejilla.
    }
    const m = Math.min(minutesAt(e.clientY), MINUTES_PER_DAY - MIN_SLOT_MINUTES)
    setDrag({ anchor: m, startMin: m, endMin: m + MIN_SLOT_MINUTES })
  }

  const onPointerMove = (e) => {
    if (!drag) return
    const m = minutesAt(e.clientY)
    setDrag((d) => {
      if (!d) return d
      const lo = Math.min(d.anchor, m)
      const hi = Math.max(d.anchor, m)
      const endMin = Math.min(MINUTES_PER_DAY, Math.max(hi, lo + MIN_SLOT_MINUTES))
      return { ...d, startMin: Math.min(lo, endMin - MIN_SLOT_MINUTES), endMin }
    })
  }

  const onPointerUp = () => {
    if (!drag) return
    const dayStart = startOfDay(date)
    onRangeSelect?.({
      beginAt: new Date(dayStart.getTime() + drag.startMin * 60_000),
      endAt: new Date(dayStart.getTime() + drag.endMin * 60_000),
    })
    setDrag(null)
  }

  // Franja en punteado: la que se está arrastrando o la pendiente de crear.
  let draftBlock = null
  if (drag) {
    draftBlock = { startMin: drag.startMin, endMin: drag.endMin }
  } else if (draft && isSameDay(draft.beginAt, date)) {
    const dayStart = startOfDay(date)
    draftBlock = {
      startMin: (draft.beginAt - dayStart) / 60_000,
      endMin: Math.min(MINUTES_PER_DAY, (draft.endAt - dayStart) / 60_000),
    }
  }

  return (
    <section className="dayview" aria-label="Vista del día por horas">
      <header className="dayview__header">
        <h2 className="dayview__title">{formatLongDate(date)}</h2>
        {isToday && <span className="dayview__badge">Hoy</span>}
        {selectable && (
          <span className="dayview__badge dayview__badge--hint">Arrastra para crear un slot</span>
        )}
        <span className="dayview__count">
          {status === 'loading'
            ? 'Cargando…'
            : laidOut.length === 0
              ? 'Nada previsto'
              : `${laidOut.length} elemento${laidOut.length === 1 ? '' : 's'}`}
        </span>
      </header>

      <div className="dayview__scroll" ref={scrollRef}>
        <div
          className={`dayview__hours${selectable ? ' dayview__hours--selectable' : ''}`}
          ref={hoursRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {HOURS.map((h) => (
            <div key={h} className="dayview__hour">
              <span className="dayview__hour-label">{pad(h)}:00</span>
              <div className="dayview__hour-slot" />
            </div>
          ))}

          <div className="dayview__events">
            {laidOut.map(({ item, startMin, endMin, lane, lanes }) => {
              const top = (startMin / MINUTES_PER_DAY) * 100
              const height = ((endMin - startMin) / MINUTES_PER_DAY) * 100
              const width = 100 / lanes
              const left = lane * width
              const compact = endMin - startMin < COMPACT_MINUTES

              return (
                <article
                  key={item.id}
                  className={[
                    'dayview__event',
                    `dayview__event--${item.type}`,
                    item.kind && `dayview__event--kind-${item.kind}`,
                    item.done && 'dayview__event--done',
                    item.subscribed && 'dayview__event--mine',
                    item.id === openItemId && 'dayview__event--open',
                    compact && 'dayview__event--compact',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    '--ev-color': itemColor(item),
                    top: `${top}%`,
                    height: `${height}%`,
                    left: `calc(${left}% + 2px)`,
                    width: `calc(${width}% - 4px)`,
                  }}
                  tabIndex={0}
                  aria-label={`${item.name}, ${itemMeta(item)}`}
                  onClick={() => onOpenItem(item)}
                  onKeyDown={openWithKeyboard(item)}
                >
                  <strong className="dayview__event-name">
                    {item.subscribed && (
                      <span className="dayview__event-badge" title="Inscrito">
                        ✓
                      </span>
                    )}
                    {item.name}
                  </strong>
                  <span className="dayview__event-meta">
                    {compact ? `${formatTime(item.beginAt)}–${formatTime(item.endAt)}` : itemMeta(item)}
                  </span>
                </article>
              )
            })}

            {draftBlock && (
              <div
                className="dayview__draft"
                style={{
                  top: `${(draftBlock.startMin / MINUTES_PER_DAY) * 100}%`,
                  height: `${((draftBlock.endMin - draftBlock.startMin) / MINUTES_PER_DAY) * 100}%`,
                }}
                aria-hidden="true"
              >
                <strong>Nuevo slot</strong>
                <span>
                  {formatMinutes(draftBlock.startMin)} – {formatMinutes(draftBlock.endMin)}
                </span>
              </div>
            )}
          </div>

          {isToday && (
            <div
              className="dayview__now"
              style={{ top: `${nowOffsetPct}%` }}
              aria-label={`Hora actual ${pad(now.getHours())}:${pad(now.getMinutes())}`}
            />
          )}
        </div>
      </div>
    </section>
  )
}

export default DayView
