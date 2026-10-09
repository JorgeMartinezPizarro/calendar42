import { useEffect, useMemo, useRef, useState } from 'react'
import { TYPE_COLORS } from '../agendaTypes.js'
import { MIN_SLOT_MINUTES } from '../subscription.js'
import { formatRange, formatTime } from '../utils/date.js'
import Markdown from './Markdown.jsx'
import './ItemPopover.css'

const TYPE_LABELS = {
  event: 'Evento',
  exam: 'Examen',
  slot: 'Slot de corrección',
  correction: 'Corrección',
  free: 'Slot libre para corrección',
}

// Subtipos de evento de la intra.
const KIND_LABELS = {
  conference: 'Conferencia',
  meetup: 'Meetup',
  workshop: 'Taller',
  atelier: 'Taller',
  rush: 'Rush',
  hackathon: 'Hackathon',
  extern: 'Externo',
  association: 'Asociación',
  partnership: 'Partner',
  challenge: 'Reto',
  piscine: 'Piscina',
  pedago: 'Pedagogía',
}

function headline(item) {
  const type = TYPE_LABELS[item.type] ?? item.type
  const kind = item.kind && item.kind !== item.type ? (KIND_LABELS[item.kind] ?? item.kind) : null
  return kind ? `${type} · ${kind}` : type
}

function capacity(item) {
  if (item.type !== 'event' && item.type !== 'exam') return null
  const n = item.subscribers ?? 0
  const people = `${n} inscrito${n === 1 ? '' : 's'}`
  return item.maxPeople ? `${people} · ${item.maxPeople} plazas` : people
}

/**
 * Horas de inicio posibles para una corrección dentro de una franja libre:
 * cada 15 min, dejando al menos la duración mínima hasta el final.
 */
function startOptions(item) {
  const step = 15 * 60_000
  const begin = item.beginAt.getTime()
  const last = Math.max(begin, item.endAt.getTime() - MIN_SLOT_MINUTES * 60_000)
  const options = []
  for (let t = begin; t <= last; t += step) options.push(new Date(t))
  return options
}

/**
 * Ficha con el contenido completo de un elemento de la agenda y su acción:
 * apuntarse o borrarse (evento, examen), agendar una corrección (franja libre)
 * o borrar un slot propio. Llena el panel que le reserva la vista del día (a
 * pantalla completa en móvil) y se cierra con su botón o con Escape.
 * - subscription: subscriptionState(item), o null si no aplica
 * - booking: { project, state: bookingState(...) } para franjas libres, o null
 * - slotDelete: slotDeleteState(item) para slots propios, o null
 * - conflicts: lo del usuario que se solapa (ver overlappingItems); null si no procede
 * - action: { busy, error } del envío en curso para este elemento, si lo hay
 */
function ItemPopover({
  item,
  subscription = null,
  booking = null,
  slotDelete = null,
  conflicts = null,
  action,
  onToggleSubscription,
  onBook,
  onDeleteSlot,
  onClose,
}) {
  const ref = useRef(null)
  const starts = useMemo(() => (item.type === 'free' ? startOptions(item) : []), [item])
  const [startAt, setStartAt] = useState(() => item.beginAt)

  // Al abrir (o cambiar de elemento) el foco pasa a la ficha: así Escape y el
  // teclado funcionan sin más, y en móvil la pantalla completa arranca arriba.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = 0
    el.focus({ preventScroll: true })
    setStartAt(item.beginAt)
  }, [item.id, item.beginAt])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const color = TYPE_COLORS[item.type] ?? TYPE_COLORS.event
  const cap = capacity(item)
  const busy = Boolean(action?.busy)
  const slotBusy = Boolean(conflicts?.length)
  const hasActions = Boolean(subscription || booking || slotDelete || conflicts)

  const feedback = (reason) => (
    <>
      {reason && !action?.error && <span className="popover__reason">{reason}</span>}
      {action?.error && (
        <span className="popover__error" role="alert">
          {action.error}
        </span>
      )}
    </>
  )

  return (
    <div
      ref={ref}
      className={`popover popover--${item.type}`}
      style={{ '--pv-color': color }}
      role="dialog"
      aria-label={item.name}
      tabIndex={-1}
    >
      <button type="button" className="popover__close" onClick={onClose} aria-label="Cerrar">
        ×
      </button>

      <div className="popover__head">
        <span className="popover__kind">{headline(item)}</span>
        {item.subscribed && <span className="popover__badge">Inscrito</span>}
      </div>
      <h3 className="popover__title">{item.name}</h3>

      <dl className="popover__meta">
        <dt>Cuándo</dt>
        <dd>{formatRange(item.beginAt, item.endAt)}</dd>
        {item.location && (
          <>
            <dt>Dónde</dt>
            <dd>{item.location}</dd>
          </>
        )}
        {cap && (
          <>
            <dt>Aforo</dt>
            <dd>{cap}</dd>
          </>
        )}
        {item.corrector?.login && (
          <>
            <dt>Corrector</dt>
            <dd>{item.corrector.login}</dd>
          </>
        )}
      </dl>

      {item.description && <Markdown className="popover__description" text={item.description} />}

      {hasActions && (
        <div className="popover__actions">
          {subscription && (
            <button
              type="button"
              className={`popover__button popover__button--${subscription.action}`}
              disabled={!subscription.enabled || busy}
              onClick={() => onToggleSubscription(item)}
            >
              {busy ? 'Un momento…' : subscription.action === 'subscribe' ? 'Apuntarme' : 'Borrarme'}
            </button>
          )}

          {booking && (
            <>
              {starts.length > 1 && (
                <label className="popover__start">
                  Empezar a las
                  <select
                    value={startAt.toISOString()}
                    disabled={busy}
                    onChange={(e) => setStartAt(new Date(e.target.value))}
                  >
                    {starts.map((d) => (
                      <option key={d.toISOString()} value={d.toISOString()}>
                        {formatTime(d)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="popover__button"
                disabled={!booking.state.enabled || busy}
                onClick={() => onBook(item, startAt)}
              >
                {busy
                  ? 'Un momento…'
                  : booking.project?.closed
                    ? `Agendar corrección de ${booking.project.name}`
                    : 'Agendar corrección'}
              </button>
            </>
          )}

          {slotDelete && (
            <button
              type="button"
              className="popover__button popover__button--unsubscribe"
              disabled={!slotDelete.enabled || busy}
              onClick={() => onDeleteSlot(item)}
            >
              {busy ? 'Un momento…' : 'Borrar slot'}
            </button>
          )}

          {conflicts && (
            <span
              className={`popover__slot popover__slot--${slotBusy ? 'busy' : 'free'}`}
              title={
                slotBusy
                  ? 'Se solapa con algo de tu agenda'
                  : 'No se solapa con nada de tu agenda'
              }
            >
              {slotBusy ? 'Slot ocupado' : 'Slot libre'}
            </span>
          )}

          {feedback(subscription?.reason ?? booking?.state.reason ?? slotDelete?.reason ?? null)}
        </div>
      )}

      {slotBusy && (
        <p className="popover__conflicts">
          Solapa con{' '}
          {conflicts
            .map((c) => `${c.name} (${formatTime(c.beginAt)}–${formatTime(c.endAt)})`)
            .join(', ')}
          .
        </p>
      )}
    </div>
  )
}

export default ItemPopover
