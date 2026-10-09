import { useEffect, useRef } from 'react'
import { TYPE_COLORS } from '../agendaTypes.js'
import { formatRange, formatTime } from '../utils/date.js'
import Markdown from './Markdown.jsx'
import './ItemPopover.css'

const TYPE_LABELS = {
  event: 'Evento',
  exam: 'Examen',
  slot: 'Slot de corrección',
  correction: 'Corrección',
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
 * Ficha con el contenido completo de un elemento de la agenda y, si es un
 * evento, el botón para apuntarse o borrarse. Llena el panel que le reserva la
 * vista del día (a la derecha de las horas; a pantalla completa en móvil) y se
 * cierra con su botón o con Escape.
 * - subscription: resultado de subscriptionState(item), o null si no aplica
 * - conflicts: lo del usuario que se solapa con el elemento (ver
 *   overlappingItems); null si no procede mostrar "slot libre / ocupado"
 * - action: { busy, error } del envío en curso para este elemento, si lo hay
 */
function ItemPopover({ item, subscription, conflicts = null, action, onToggleSubscription, onClose }) {
  const ref = useRef(null)

  // Al abrir (o cambiar de elemento) el foco pasa a la ficha: así Escape y el
  // teclado funcionan sin más, y en móvil la pantalla completa arranca arriba.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = 0
    el.focus({ preventScroll: true })
  }, [item.id])

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
      </dl>

      {item.description && <Markdown className="popover__description" text={item.description} />}

      {(subscription || conflicts) && (
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
          {subscription?.reason && !action?.error && (
            <span className="popover__reason">{subscription.reason}</span>
          )}
          {action?.error && (
            <span className="popover__error" role="alert">
              {action.error}
            </span>
          )}
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
