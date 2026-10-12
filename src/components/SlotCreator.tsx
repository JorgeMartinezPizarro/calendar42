import { t } from '../i18n/index.ts'
import { MIN_SLOT_MINUTES, SLOT_GAP_MINUTES, slotCreateState } from '../subscription.ts'
import type { Item, TimeRange } from '../types.ts'
import { formatRange, formatTime } from '../utils/date.ts'
import './SlotCreator.css'

/** Último envío al crear un slot. */
export interface SlotAction {
  busy: boolean
  error: string | null
  /** El slot creado, para el aviso "Slot creado". */
  created: TimeRange | null
}

export type SlotEdge = 'start' | 'end'

interface SlotCreatorProps {
  /** Franja marcada en las horas del día, pendiente de crear. */
  pending: TimeRange | null
  action: SlotAction
  now: Date
  /** La agenda, para no crear un slot que pise lo que ya hay. */
  items?: Item[]
  onCreate: () => void
  onCancel: () => void
  /** Mueve el inicio o el fin de la franja, en minutos. */
  onAdjust?: (edge: SlotEdge, minutes: number) => void
}

/**
 * Modo "Crear slots": instrucciones, la franja marcada, su ajuste fino y el
 * botón para crearla. El error de la intra se pinta en rojo junto al botón, y
 * lo que no procede (motivo) en naranja.
 */
function SlotCreator({ pending, action, now, items = [], onCreate, onCancel, onAdjust }: SlotCreatorProps) {
  const state = pending ? slotCreateState(pending, now, items) : null

  const stepper = (adjust: NonNullable<SlotCreatorProps['onAdjust']>, edge: SlotEdge, label: string, time: Date) => (
    <span className="slotcreator__step">
      <span className="slotcreator__step-label">{label}</span>
      <button
        type="button"
        onClick={() => adjust(edge, -15)}
        disabled={action.busy}
        aria-label={t.slots.earlier(label)}
      >
        −15
      </button>
      <span className="slotcreator__step-time">{formatTime(time)}</span>
      <button
        type="button"
        onClick={() => adjust(edge, 15)}
        disabled={action.busy}
        aria-label={t.slots.later(label)}
      >
        +15
      </button>
    </span>
  )

  return (
    <section className="slotcreator" aria-label={t.slots.label}>
      <h2 className="slotcreator__title">{t.slots.title}</h2>

      {!pending && (
        <p className="slotcreator__hint">{t.slots.hint(MIN_SLOT_MINUTES, SLOT_GAP_MINUTES)}</p>
      )}

      {pending && state ? (
        <div className="slotcreator__pending">
          <p className="slotcreator__range">{t.slots.pending(formatRange(pending.beginAt, pending.endAt))}</p>
          {onAdjust && (
            <div className="slotcreator__steps">
              {stepper(onAdjust, 'start', t.slots.start, pending.beginAt)}
              {stepper(onAdjust, 'end', t.slots.end, pending.endAt)}
            </div>
          )}
          <div className="slotcreator__actions">
            <button
              type="button"
              className="slotcreator__button"
              disabled={!state.enabled || action.busy}
              onClick={onCreate}
            >
              {action.busy ? t.slots.creating : t.slots.create}
            </button>
            <button
              type="button"
              className="slotcreator__button slotcreator__button--secondary"
              disabled={action.busy}
              onClick={onCancel}
            >
              {t.common.cancel}
            </button>
            {state.reason && !action.error && <span className="slotcreator__reason">{state.reason}</span>}
            {action.error && (
              <span className="slotcreator__error" role="alert">
                {action.error}
              </span>
            )}
          </div>
        </div>
      ) : action.created ? (
        <p className="slotcreator__ok">{t.slots.created(formatRange(action.created.beginAt, action.created.endAt))}</p>
      ) : null}
    </section>
  )
}

export default SlotCreator
