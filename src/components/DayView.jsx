import { useEffect, useRef } from 'react'
import { TYPE_COLORS } from '../agendaTypes.js'
import { useNow } from '../hooks/useNow.js'
import { addDays, formatLongDate, formatTime, isSameDay, startOfDay } from '../utils/date.js'
import './DayView.css'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const DEFAULT_SCROLL_HOUR = 8
const MINUTES_PER_DAY = 24 * 60

function pad(n) {
  return String(n).padStart(2, '0')
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
 */
function DayView({ date, items = [], status, panel = null, openItemId = null, onOpenItem }) {
  const now = useNow()
  const scrollRef = useRef(null)
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

  return (
    <section className="dayview" aria-label="Vista del día por horas">
      <header className="dayview__header">
        <h2 className="dayview__title">{formatLongDate(date)}</h2>
        {isToday && <span className="dayview__badge">Hoy</span>}
        <span className="dayview__count">
          {status === 'loading'
            ? 'Cargando…'
            : laidOut.length === 0
              ? 'Nada previsto'
              : `${laidOut.length} elemento${laidOut.length === 1 ? '' : 's'}`}
        </span>
      </header>

      <div className="dayview__scroll" ref={scrollRef}>
        <div className="dayview__hours">
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
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    '--ev-color': TYPE_COLORS[item.type] ?? TYPE_COLORS.event,
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
                  <span className="dayview__event-meta">{itemMeta(item)}</span>
                </article>
              )
            })}
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
