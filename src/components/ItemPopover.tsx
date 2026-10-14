import { useEffect, useMemo, useRef, useState } from 'react'
import { itemColor } from '../agendaTypes.ts'
import { t } from '../i18n/index.ts'
import { itemDescription, itemName } from '../itemText.ts'
import { evaluationMinutesOf, type BookingState, type ButtonState, type SubscriptionState } from '../subscription.ts'
import type { ActionState, Item, Project } from '../types.ts'
import { formatRange, formatTime } from '../utils/date.ts'
import Markdown from './Markdown.tsx'
import './ItemPopover.css'

function headline(item: Item): string {
  const type = t.itemType[item.type] ?? item.type
  const kind = item.kind && item.kind !== item.type ? (t.kinds[item.kind] ?? item.kind) : null
  return kind ? `${type} · ${kind}` : type
}

function capacity(item: Item): string | null {
  if (item.type !== 'event' && item.type !== 'exam') return null
  const n = item.subscribers ?? 0
  const people = t.popover.people(n)
  return item.maxPeople ? `${people} · ${t.popover.seats(item.maxPeople)}` : people
}

/**
 * Horas de inicio posibles para una corrección dentro de una franja libre:
 * cada 15 min, dejando hasta el final lo que dura la corrección del proyecto.
 */
function startOptions(item: Item): Date[] {
  const step = 15 * 60_000
  const begin = item.beginAt.getTime()
  const last = Math.max(begin, item.endAt.getTime() - evaluationMinutesOf(item) * 60_000)
  const options: Date[] = []
  for (let t = begin; t <= last; t += step) options.push(new Date(t))
  return options
}

/** Reserva de una corrección en una franja libre. */
export interface BookingInfo {
  project: Project | null
  /** Estado de la reserva (bookingState) empezando a esa hora. */
  stateAt: (startAt: Date) => BookingState
}

interface ItemPopoverProps {
  item: Item
  /** subscriptionState(item), o null si no aplica. */
  subscription?: SubscriptionState | null
  /** Para franjas libres, o null. */
  booking?: BookingInfo | null
  /** slotDeleteState(item) para slots propios, o null. */
  slotDelete?: ButtonState | null
  /** Lo del usuario que se solapa (ver overlappingItems); null si no procede. */
  conflicts?: Item[] | null
  /** El envío en curso para este elemento, si lo hay. */
  action?: ActionState | null
  onToggleSubscription: (item: Item) => void
  onBook: (item: Item, startAt: Date) => void
  onDeleteSlot: (item: Item) => void
  onClose: () => void
}

/**
 * Ficha con el contenido completo de un elemento de la agenda y su acción:
 * apuntarse o borrarse (evento, examen), agendar una corrección (franja libre)
 * o borrar un slot propio. Llena el panel que le reserva la vista del día (a
 * pantalla completa en móvil) y se cierra con su botón o con Escape.
 */
function ItemPopover({
  item,
  subscription = null,
  booking = null,
  slotDelete = null,
  conflicts = null,
  action = null,
  onToggleSubscription,
  onBook,
  onDeleteSlot,
  onClose,
}: ItemPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const starts = useMemo(() => (item.type === 'free' ? startOptions(item) : []), [item])
  // Por defecto, la primera hora de la franja que no choca con la agenda.
  const firstFreeStart = booking
    ? (starts.find((d) => !booking.stateAt(d).overlap) ?? item.beginAt)
    : item.beginAt
  const [startAt, setStartAt] = useState(() => item.beginAt)

  // Al abrir (o cambiar de elemento) el foco pasa a la ficha: así Escape y el
  // teclado funcionan sin más, y en móvil la pantalla completa arranca arriba.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = 0
    el.focus({ preventScroll: true })
    setStartAt(firstFreeStart)
    // Solo al abrir otro elemento: no se pisa la hora que el usuario elija.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.beginAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const color = itemColor(item)
  const description = itemDescription(item)
  const cap = capacity(item)
  const busy = Boolean(action?.busy)
  const slotBusy = Boolean(conflicts?.length)
  const hasActions = Boolean(subscription || booking || slotDelete || conflicts || item.signupUrl)
  const bookingNow = booking ? booking.stateAt(startAt) : null

  const feedback = (reason: string | null) => (
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
      aria-label={itemName(item)}
      tabIndex={-1}
    >
      <button type="button" className="popover__close" onClick={onClose} aria-label={t.common.close}>
        ×
      </button>

      <div className="popover__head">
        <span className="popover__kind">{headline(item)}</span>
        {item.signupUrl && (
          <span className="popover__badge popover__badge--external">{t.popover.externalSignup}</span>
        )}
        {item.subscribed && <span className="popover__badge">{t.popover.subscribed}</span>}
      </div>
      <h3 className="popover__title">{itemName(item)}</h3>

      <dl className="popover__meta">
        <dt>{t.popover.when}</dt>
        <dd>{formatRange(item.beginAt, item.endAt)}</dd>
        {item.location && (
          <>
            <dt>{t.popover.where}</dt>
            <dd>{item.location}</dd>
          </>
        )}
        {cap && (
          <>
            <dt>{t.popover.capacity}</dt>
            <dd>{cap}</dd>
          </>
        )}
        {item.corrector?.login && (
          <>
            <dt>{t.popover.corrector}</dt>
            <dd>{item.corrector.login}</dd>
          </>
        )}
      </dl>

      {description && <Markdown className="popover__description" text={description} />}

      {hasActions && (
        <div className="popover__actions">
          {subscription && (
            <button
              type="button"
              className={`popover__button popover__button--${subscription.action}`}
              disabled={!subscription.enabled || busy}
              onClick={() => onToggleSubscription(item)}
            >
              {busy ? t.common.oneMoment : subscription.action === 'subscribe' ? t.popover.subscribe : t.popover.unsubscribe}
            </button>
          )}

          {item.signupUrl && (
            <a
              className="popover__button popover__button--link"
              href={item.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={item.signupUrl}
            >
              {t.popover.signupOnWeb}
            </a>
          )}

          {booking && bookingNow && (
            <>
              {starts.length > 1 && (
                <label className="popover__start">
                  {t.popover.startAt}
                  <select
                    value={startAt.toISOString()}
                    disabled={busy}
                    onChange={(e) => setStartAt(new Date(e.target.value))}
                  >
                    {starts.map((d) => (
                      <option key={d.toISOString()} value={d.toISOString()}>
                        {formatTime(d)}
                        {booking.stateAt(d).overlap ? t.popover.clashes : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="popover__button"
                disabled={!bookingNow.enabled || busy}
                onClick={() => onBook(item, startAt)}
              >
                {busy
                  ? t.common.oneMoment
                  : booking.project?.closed
                    ? t.popover.bookProject(booking.project.name)
                    : t.popover.book}
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
              {busy ? t.common.oneMoment : t.popover.deleteSlot}
            </button>
          )}

          {conflicts && (
            <span
              className={`popover__slot popover__slot--${slotBusy ? 'busy' : 'free'}`}
              title={slotBusy ? t.popover.slotBusyTitle : t.popover.slotFreeTitle}
            >
              {slotBusy ? t.popover.slotBusy : t.popover.slotFree}
            </span>
          )}

          {feedback(subscription?.reason ?? bookingNow?.reason ?? slotDelete?.reason ?? null)}
        </div>
      )}

      {conflicts && slotBusy && (
        <p className="popover__conflicts">
          {t.popover.overlapsWith}{' '}
          {conflicts.map((c) => `${itemName(c)} (${formatTime(c.beginAt)}–${formatTime(c.endAt)})`).join(', ')}.
        </p>
      )}
    </div>
  )
}

export default ItemPopover
